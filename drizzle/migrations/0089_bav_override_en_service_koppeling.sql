-- 1. Vastleggen productiestand: ongekoppelde vermeldingen blokkeren niets
CREATE OR REPLACE FUNCTION public.bav_nummer_bezet_door(_nummer text, _voor_ond uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('onderneming_id', b.onderneming_id, 'naam', o.naam, 'exact_relatie_code', o.exact_relatie_code, 'bron', b.bron, 'nummer', b.nummer)
    FROM public.crm_bav_nummers b LEFT JOIN public.ondernemingen o ON o.id = b.onderneming_id
   WHERE public.bav_sleutel(b.nummer) = public.bav_sleutel(_nummer) AND b.bron <> 'hiscox'
     AND b.onderneming_id IS NOT NULL
     AND b.onderneming_id IS DISTINCT FROM _voor_ond
     AND NOT (_voor_ond IS NOT NULL AND b.onderneming_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.onderneming_opvolging x
          WHERE (x.van_onderneming_id = b.onderneming_id AND x.naar_onderneming_id = _voor_ond) OR (x.naar_onderneming_id = b.onderneming_id AND x.van_onderneming_id = _voor_ond)))
   ORDER BY (b.bron IN ('zp','bevestigd','overgenomen')) DESC LIMIT 1
$function$;

-- 2. Info voor de melding "bestaat al": andere klant plus serviceaanvragen met dit nummer
CREATE OR REPLACE FUNCTION public.bav_nummer_bezet_info(_nummer text, _onderneming_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN jsonb_build_object(
    'bezet', public.bav_nummer_bezet_door(_nummer, _onderneming_id),
    'aanvragen', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'naam', btrim(coalesce(a.voornaam,'') || ' ' || coalesce(a.achternaam,'')),
        'email', a.email, 'created_at', a.created_at, 'onderneming_id', a.onderneming_id, 'onderneming_naam', o.naam) ORDER BY a.created_at)
      FROM public.klant_service_aanvragen a LEFT JOIN public.ondernemingen o ON o.id = a.onderneming_id
     WHERE public.bav_sleutel(a.polisnummer) = public.bav_sleutel(_nummer) AND a.polisnummer !~* '^\s*HPI\.'
       AND a.onderneming_id IS DISTINCT FROM _onderneming_id AND a.gekoppeld_aan IS NULL), '[]'::jsonb));
END $function$;
REVOKE ALL ON FUNCTION public.bav_nummer_bezet_info(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_bezet_info(text, uuid) TO authenticated;

-- 3. Serviceaanvraag handmatig koppelen aan klant (geaudit)
CREATE OR REPLACE FUNCTION public.service_aanvraag_koppelen(_aanvraag_id uuid, _onderneming_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_oud uuid; v_status text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ondernemingen WHERE id = _onderneming_id) THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  SELECT onderneming_id, koppeling_status INTO v_oud, v_status FROM public.klant_service_aanvragen WHERE id = _aanvraag_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  UPDATE public.klant_service_aanvragen SET onderneming_id = _onderneming_id, koppeling_status = 'zeker', koppeling_methode = 'handmatig_beheer'
   WHERE id = _aanvraag_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', _aanvraag_id, 'service_aanvraag_gekoppeld', 'onderneming_id', v_oud::text, _onderneming_id::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('oude_status', v_status, 'koppeling_methode', 'handmatig_beheer'));
  RETURN jsonb_build_object('aanvraag_id', _aanvraag_id, 'onderneming_id', _onderneming_id);
END $function$;
REVOKE ALL ON FUNCTION public.service_aanvraag_koppelen(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_aanvraag_koppelen(uuid, uuid) TO authenticated;

-- 4. Override: bewust koppelen ondanks bezet
CREATE OR REPLACE FUNCTION public.bav_nummer_override_bevestigen(_onderneming_id uuid, _nummer text, _reden text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_nr text := upper(regexp_replace(btrim(coalesce(_nummer,'')),'\s+','','g')); v_id uuid; v_bezet jsonb; v_reden text := btrim(coalesce(_reden,''));
  v_naam text; v_ander uuid; v_log uuid;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT naam INTO v_naam FROM public.ondernemingen WHERE id = _onderneming_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  IF length(v_nr) < 3 OR v_nr !~ '^[A-Z0-9.\-/]+$' THEN RAISE EXCEPTION 'ongeldig BAV-nummer'; END IF;
  IF length(v_reden) < 10 THEN RAISE EXCEPTION 'reden is verplicht (minimaal 10 tekens)'; END IF;
  v_bezet := public.bav_nummer_bezet_door(v_nr, _onderneming_id);
  v_ander := nullif(v_bezet->>'onderneming_id','')::uuid;
  INSERT INTO public.bav_nummer_bevestigingen (onderneming_id, nummer, herkomst, toelichting, bevestigd_door)
  VALUES (_onderneming_id, v_nr, 'override', v_reden, auth.uid())
  ON CONFLICT (onderneming_id, nummer) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('nummer', v_nr, 'nieuw', false); END IF;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('bav_nummer_bevestigingen', v_id, 'bav_nummer_override', 'nummer', NULL, v_nr, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', _onderneming_id, 'onderneming_naam', v_naam, 'herkomst', 'override', 'reden', v_reden,
      'andere_onderneming_id', v_ander, 'andere_naam', v_bezet->>'naam', 'andere_exact_relatie_code', v_bezet->>'exact_relatie_code', 'andere_bron', v_bezet->>'bron'))
  RETURNING id INTO v_log;
  PERFORM public.crm_notitie_toevoegen(_onderneming_id, NULL, 'notitie',
    'BAV-nummer ' || v_nr || ' is ook gekoppeld aan ' || coalesce(v_bezet->>'naam','een andere klant') || ', reden: ' || v_reden, jsonb_build_object('bav_nummer', v_nr, 'override', true));
  IF v_ander IS NOT NULL THEN
    PERFORM public.crm_notitie_toevoegen(v_ander, NULL, 'notitie',
      'BAV-nummer ' || v_nr || ' is ook gekoppeld aan ' || coalesce(v_naam,'een andere klant') || ', reden: ' || v_reden, jsonb_build_object('bav_nummer', v_nr, 'override', true));
  END IF;
  RETURN jsonb_build_object('nummer', v_nr, 'nieuw', true, 'audit_id', v_log);
END $function$;
REVOKE ALL ON FUNCTION public.bav_nummer_override_bevestigen(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_override_bevestigen(uuid, text, text) TO authenticated;

-- 5. Automatische koppeling bij binnenkomst (niet-opzeggen): e-mail, contactpersoon, dan bedrijfsnaam
CREATE OR REPLACE FUNCTION public.bepaal_service_koppeling(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE a public.klant_service_aanvragen; ids uuid[]; v_email text; v_dom text; v_naam text; best record;
  v_status text; v_methode text; v_ond uuid; v_voorstel uuid;
BEGIN
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _id;
  IF a.id IS NULL OR a.type = 'opzeggen' OR a.onderneming_id IS NOT NULL OR a.is_test THEN RETURN NULL; END IF;
  v_email := nullif(lower(btrim(coalesce(a.email,''))), '');
  v_naam := nullif(btrim(coalesce(a.details->>'bedrijfsnaam','')), '');
  -- a. e-mail persoon of factuur-e-mail
  IF v_email IS NOT NULL THEN
    SELECT array_agg(DISTINCT x) INTO ids FROM (
      SELECT po.onderneming_id x FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
       WHERE p.genormaliseerd_email = v_email AND NOT p.is_test
      UNION SELECT o.id FROM public.ondernemingen o WHERE lower(btrim(o.factuur_email)) = v_email AND NOT o.is_test) s;
    IF coalesce(array_length(ids,1),0) = 1 THEN v_status := 'zeker'; v_methode := 'email'; v_ond := ids[1];
    ELSIF coalesce(array_length(ids,1),0) > 1 THEN v_status := 'voorstel'; v_methode := 'email_meerdere'; v_voorstel := ids[1]; END IF;
  END IF;
  -- b. contactpersoon (voor- en achternaam)
  IF v_status IS NULL AND btrim(coalesce(a.achternaam,'')) <> '' THEN
    SELECT array_agg(DISTINCT po.onderneming_id) INTO ids FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
     WHERE lower(btrim(p.achternaam)) = lower(btrim(a.achternaam)) AND lower(btrim(coalesce(p.voornaam,''))) = lower(btrim(coalesce(a.voornaam,''))) AND NOT p.is_test;
    IF coalesce(array_length(ids,1),0) = 1 THEN v_status := 'zeker'; v_methode := 'contactpersoon'; v_ond := ids[1];
    ELSIF coalesce(array_length(ids,1),0) > 1 THEN v_status := 'voorstel'; v_methode := 'contactpersoon_meerdere'; v_voorstel := ids[1]; END IF;
  END IF;
  -- c. zelfde (niet-algemeen) e-maildomein: alleen voorstel
  IF v_status IS NULL AND v_email IS NOT NULL THEN
    v_dom := split_part(v_email, '@', 2);
    IF v_dom <> '' AND v_dom NOT IN ('gmail.com','hotmail.com','outlook.com','live.nl','live.com','hotmail.nl','icloud.com','yahoo.com','ziggo.nl','kpnmail.nl','planet.nl','xs4all.nl','home.nl','me.com','msn.com','upcmail.nl') THEN
      SELECT array_agg(DISTINCT po.onderneming_id) INTO ids FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
       WHERE p.genormaliseerd_email LIKE '%@' || v_dom AND NOT p.is_test;
      IF coalesce(array_length(ids,1),0) >= 1 THEN v_status := 'voorstel'; v_methode := 'zelfde_domein'; v_voorstel := ids[1]; END IF;
    END IF;
  END IF;
  -- d. bedrijfsnaam (fuzzy): alleen voorstel
  IF v_status IS NULL AND v_naam IS NOT NULL THEN
    SELECT o.id, similarity(lower(o.naam), lower(v_naam)) s INTO best FROM public.ondernemingen o
     WHERE o.naam IS NOT NULL AND NOT o.is_test ORDER BY similarity(lower(o.naam), lower(v_naam)) DESC LIMIT 1;
    IF best.id IS NOT NULL AND best.s >= 0.5 THEN v_status := 'voorstel'; v_methode := 'bedrijfsnaam'; v_voorstel := best.id; END IF;
  END IF;
  IF v_status IS NULL THEN v_status := 'niet_gekoppeld'; END IF;
  UPDATE public.klant_service_aanvragen SET onderneming_id = v_ond, koppeling_status = v_status, koppeling_methode = v_methode,
    koppeling_details = coalesce(koppeling_details,'{}'::jsonb) || CASE WHEN v_voorstel IS NOT NULL THEN jsonb_build_object('voorstel_onderneming_id', v_voorstel) ELSE '{}'::jsonb END
   WHERE id = _id;
  RETURN jsonb_build_object('status', v_status, 'methode', v_methode, 'onderneming_id', v_ond, 'voorstel', v_voorstel);
END $function$;
REVOKE ALL ON FUNCTION public.bepaal_service_koppeling(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_opzegging_koppeling()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'opzeggen' THEN
    BEGIN PERFORM public.bepaal_opzegging_koppeling(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.klant_service_aanvragen SET koppeling_status = 'niet_gekoppeld' WHERE id = NEW.id;
    END;
  ELSIF NEW.onderneming_id IS NULL THEN
    BEGIN PERFORM public.bepaal_service_koppeling(NEW.id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NULL;
END $function$;