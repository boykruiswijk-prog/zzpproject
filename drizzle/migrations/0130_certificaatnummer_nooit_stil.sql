CREATE OR REPLACE FUNCTION public.generate_certificate_number()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n bigint; vrij bigint; v jsonb;
BEGIN
  IF upper(coalesce(NEW.certificate_number,'')) = 'NIEUW' THEN
    -- Alleen na expliciete bevestiging door het team (generate-certificate met bevestig_nieuw_nummer).
    n := nextval('public.policy_cert_seq');
    vrij := public.eerste_vrije_certificaatnummer(n);
    IF vrij > n THEN PERFORM setval('public.policy_cert_seq', vrij); END IF;
    NEW.certificate_number := 'ZPBAV' || vrij::text;
    RETURN NEW;
  ELSIF coalesce(NEW.certificate_number,'') = '' THEN
    v := public.certificaatnummer_voorstel_intern(NEW.onderneming_id, NEW.lead_id);
    IF NEW.onderneming_id IS NULL AND (v->>'onderneming_id') IS NOT NULL THEN
      NEW.onderneming_id := (v->>'onderneming_id')::uuid;
    END IF;
    IF v->>'nummer' IS NOT NULL THEN
      IF (v->>'staat_al_op_policy')::boolean THEN
        RAISE EXCEPTION 'Nummer % (%) staat al op een certificaat van deze klant. Gebruik Aanpassen, of kies expliciet een nieuw nummer.', v->>'nummer', v->>'bron';
      END IF;
      NEW.certificate_number := v->>'nummer';
      RETURN NEW;
    END IF;
    -- A14: nooit meer stil een nieuw nummer.
    RAISE EXCEPTION 'Geen bekend BAV-nummer; bevestig eerst een nummer';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.volgend_vrij_certificaatnummer_voorbeeld()
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_last bigint; v_called boolean;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT last_value, is_called INTO v_last, v_called FROM public.policy_cert_seq;
  RETURN 'ZPBAV' || public.eerste_vrije_certificaatnummer(CASE WHEN v_called THEN v_last + 1 ELSE v_last END)::text;
END $function$;
REVOKE ALL ON FUNCTION public.volgend_vrij_certificaatnummer_voorbeeld() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.volgend_vrij_certificaatnummer_voorbeeld() TO authenticated, service_role;

-- Bezet-check voor de UI (alleen team).
CREATE OR REPLACE FUNCTION public.bav_nummer_bezet_check(_nummer text, _onderneming_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN public.bav_nummer_bezet_door(upper(regexp_replace(btrim(coalesce(_nummer,'')),'\s+','','g')), _onderneming_id);
END $function$;
REVOKE ALL ON FUNCTION public.bav_nummer_bezet_check(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_bezet_check(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.policy_nummer_wijzigen(_policy_id uuid, _nieuw_nummer text, _reden text, _oude_pdf_pad text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.policies; v_nr text := upper(regexp_replace(btrim(coalesce(_nieuw_nummer,'')),'\s+','','g'));
  v_reden text := btrim(coalesce(_reden,'')); v_ond uuid; v_bezet jsonb; v_email text; v_audit uuid;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(v_reden) < 10 THEN RAISE EXCEPTION 'reden is verplicht (minimaal 10 tekens)'; END IF;
  IF length(v_nr) < 3 OR v_nr !~ '^[A-Z0-9.\-/]+$' THEN RAISE EXCEPTION 'ongeldig BAV-nummer'; END IF;
  SELECT * INTO p FROM public.policies WHERE id = _policy_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'certificaat niet gevonden'; END IF;
  IF p.status <> 'geldig' THEN RAISE EXCEPTION 'certificaat is ingetrokken'; END IF;
  IF upper(p.certificate_number) = v_nr THEN RAISE EXCEPTION 'nummer is ongewijzigd'; END IF;
  v_ond := coalesce(p.onderneming_id, nullif(public.certificaatnummer_voorstel_intern(NULL, p.lead_id)->>'onderneming_id','')::uuid);
  IF v_ond IS NULL THEN RAISE EXCEPTION 'Koppel het certificaat eerst aan een klant'; END IF;
  IF EXISTS (SELECT 1 FROM public.policies WHERE upper(certificate_number) = v_nr AND id <> p.id AND status = 'geldig') THEN
    RAISE EXCEPTION 'nummer % staat al op een ander geldig certificaat', v_nr; END IF;
  v_bezet := public.bav_nummer_bezet_door(v_nr, v_ond);
  IF v_bezet IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bav_nummer_bevestigingen b
       WHERE b.onderneming_id = v_ond AND b.herkomst = 'override' AND public.bav_sleutel(b.nummer) = public.bav_sleutel(v_nr)) THEN
    RAISE EXCEPTION 'BAV-nummer % bestaat al bij %; gebruik Toch koppelen (override met reden)', v_nr, coalesce(v_bezet->>'naam','een andere klant');
  END IF;
  INSERT INTO public.bav_nummer_bevestigingen (onderneming_id, nummer, herkomst, toelichting, bevestigd_door)
  VALUES (v_ond, v_nr, 'handmatig', v_reden, auth.uid()) ON CONFLICT (onderneming_id, nummer) DO NOTHING;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.policy_versies (policy_id, certificate_number, versie, actie, oude_waarden, nieuwe_waarden, oude_pdf_pad, reden, uitgevoerd_door, uitgevoerd_door_email)
  VALUES (p.id, p.certificate_number, p.versie, 'nummer_vervangen',
    jsonb_build_object('certificate_number', p.certificate_number, 'onderneming_id', p.onderneming_id),
    jsonb_build_object('certificate_number', v_nr, 'onderneming_id', v_ond, 'versie', p.versie + 1),
    _oude_pdf_pad, v_reden, auth.uid(), v_email);
  PERFORM set_config('app.cert_nummer_overnemen', 'on', true);
  UPDATE public.policies SET certificate_number = v_nr, onderneming_id = v_ond, versie = versie + 1,
    issued_date = (now() AT TIME ZONE 'Europe/Amsterdam')::date WHERE id = p.id;
  PERFORM set_config('app.cert_nummer_overnemen', 'off', true);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('policies', p.id, 'certificaatnummer_gewijzigd', 'certificate_number', p.certificate_number, v_nr, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', v_ond, 'reden', v_reden, 'versie', p.versie + 1, 'override', v_bezet IS NOT NULL))
  RETURNING id INTO v_audit;
  PERFORM public.crm_notitie_toevoegen(v_ond, NULL, 'notitie',
    'BAV-nummer op certificaat gewijzigd van ' || p.certificate_number || ' naar ' || v_nr || ': ' || v_reden, jsonb_build_object('bav_nummer', v_nr, 'oud', p.certificate_number));
  RETURN jsonb_build_object('gewijzigd', true, 'oud', p.certificate_number, 'nummer', v_nr, 'audit_id', v_audit);
END $function$;
REVOKE ALL ON FUNCTION public.policy_nummer_wijzigen(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.policy_nummer_wijzigen(uuid, text, text, text) TO authenticated, service_role;