ALTER TABLE public.policies DROP CONSTRAINT IF EXISTS policies_certificate_number_key;
DROP INDEX IF EXISTS public.policies_certificate_number_key;
CREATE UNIQUE INDEX policies_certificate_number_geldig_key ON public.policies (certificate_number) WHERE status = 'geldig';
CREATE INDEX IF NOT EXISTS idx_policies_certificate_number ON public.policies (upper(certificate_number));

ALTER TABLE public.policy_versies DROP CONSTRAINT IF EXISTS policy_versies_actie_check;
ALTER TABLE public.policy_versies ADD CONSTRAINT policy_versies_actie_check
  CHECK (actie = ANY (ARRAY['aangepast','ingetrokken','gemaild','nummer_vervangen','vervangen_door_nieuw']));

CREATE OR REPLACE FUNCTION public.certificaatnummer_voorstel_intern(_onderneming_id uuid, _lead_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ond uuid := _onderneming_id; r record; g record; i record; v_n int;
BEGIN
  IF v_ond IS NULL AND _lead_id IS NOT NULL THEN
    SELECT count(DISTINCT po.onderneming_id), min(po.onderneming_id::text)::uuid INTO v_n, v_ond
      FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id
     WHERE k.bron_tabel = 'leads' AND k.bron_id = _lead_id;
    IF v_n <> 1 THEN v_ond := NULL; END IF;
  END IF;

  FOR r IN
    SELECT * FROM (
      SELECT 1 prio, 'overgenomen' bron, upper(btrim(o.bav_nummer)) nummer, o.vastgelegd_op datum, o.vastgelegd_door door
        FROM onderneming_opvolging o
       WHERE coalesce(btrim(o.bav_nummer),'') <> '' AND NOT o.is_test
         AND ((v_ond IS NOT NULL AND o.naar_onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND o.lead_id = _lead_id))
      UNION ALL
      SELECT 2, 'bevestigd', upper(btrim(b.nummer)), b.bevestigd_op, b.bevestigd_door
        FROM bav_nummer_bevestigingen b WHERE v_ond IS NOT NULL AND b.onderneming_id = v_ond
      UNION ALL
      SELECT 3, 'klant_certificaat', upper(btrim(c.certificaatnummer)), coalesce(c.beoordeeld_op, c.aanvraagdatum::timestamptz), c.beoordeeld_door
        FROM klant_certificaten c WHERE v_ond IS NOT NULL AND c.onderneming_id = v_ond AND c.koppeling_status = 'bevestigd' AND NOT c.is_test
      UNION ALL
      SELECT 4, 'eerdere_policy', upper(btrim(pp.certificate_number)), pp.created_at, NULL::uuid
        FROM policies pp WHERE (v_ond IS NOT NULL AND pp.onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND pp.lead_id = _lead_id)
    ) x
    WHERE x.nummer ~ '^ZPBAV[0-9]+$'
    ORDER BY prio, datum DESC NULLS LAST
  LOOP
    -- Geldige policy met dit nummer (maximaal één).
    g := NULL;
    SELECT id, onderneming_id, lead_id INTO g FROM policies WHERE upper(certificate_number) = r.nummer AND status = 'geldig' LIMIT 1;
    IF g.id IS NOT NULL AND NOT ((v_ond IS NOT NULL AND g.onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND g.lead_id = _lead_id)) THEN
      CONTINUE; -- geldig bij een andere klant
    END IF;
    -- Ingetrokken policy van een andere klant: nooit hergebruiken.
    IF EXISTS (SELECT 1 FROM policies q WHERE upper(q.certificate_number) = r.nummer AND q.status <> 'geldig'
               AND NOT ((v_ond IS NOT NULL AND q.onderneming_id IS NOT DISTINCT FROM v_ond) OR (_lead_id IS NOT NULL AND q.lead_id IS NOT DISTINCT FROM _lead_id))) THEN
      CONTINUE;
    END IF;
    i := NULL;
    SELECT id INTO i FROM policies WHERE upper(certificate_number) = r.nummer AND status = 'ingetrokken'
      ORDER BY coalesce(ingetrokken_op, created_at) DESC LIMIT 1;
    RETURN jsonb_build_object('nummer', r.nummer,
      'bron', CASE WHEN g.id IS NULL AND i.id IS NOT NULL AND r.bron = 'eerdere_policy' THEN 'eerdere_policy_ingetrokken' ELSE r.bron END,
      'datum', r.datum, 'door_naam', (SELECT full_name FROM profiles WHERE id = r.door), 'onderneming_id', v_ond,
      'staat_al_op_policy', g.id IS NOT NULL,
      'policy_status', CASE WHEN g.id IS NOT NULL THEN 'geldig' WHEN i.id IS NOT NULL THEN 'ingetrokken' END,
      'vervangt_ingetrokken_policy_id', CASE WHEN g.id IS NULL THEN i.id END);
  END LOOP;
  RETURN jsonb_build_object('nummer', NULL, 'bron', 'geen', 'onderneming_id', v_ond);
END $function$;

CREATE OR REPLACE FUNCTION public.policy_nummer_wijzigen(_policy_id uuid, _nieuw_nummer text, _reden text, _oude_pdf_pad text DEFAULT NULL::text)
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
  IF EXISTS (SELECT 1 FROM public.policies WHERE upper(certificate_number) = v_nr AND id <> p.id AND onderneming_id IS DISTINCT FROM v_ond) THEN
    RAISE EXCEPTION 'nummer % staat op een (ingetrokken) certificaat van een andere klant', v_nr; END IF;
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

-- Vangnet in de database: nooit een nummer van een andere klant op een nieuwe geldige policy.
CREATE OR REPLACE FUNCTION public.guard_policy_nummer_andere_klant()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'geldig' AND coalesce(NEW.certificate_number,'') <> '' AND NEW.onderneming_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.policies q WHERE upper(q.certificate_number) = upper(NEW.certificate_number)
                 AND q.id <> NEW.id AND q.onderneming_id IS NOT NULL AND q.onderneming_id <> NEW.onderneming_id) THEN
    RAISE EXCEPTION 'Nummer % staat op een certificaat van een andere klant', NEW.certificate_number;
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.guard_policy_nummer_andere_klant() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_guard_policy_nummer_andere_klant ON public.policies;
CREATE TRIGGER zz_guard_policy_nummer_andere_klant BEFORE INSERT ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_policy_nummer_andere_klant();