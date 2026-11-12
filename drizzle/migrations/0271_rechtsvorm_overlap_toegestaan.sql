-- Besluit Boy 12-11-2026 12:11: rechtsvormwijziging zonder aansluitplicht. Oude onderneming stopt precies op de opgegeven einddatum.
DROP FUNCTION IF EXISTS public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.crm_ondernemingswijziging(_van uuid, _naar uuid, _naam text, _kvk text, _rechtsvorm text, _ingangsdatum date, _soort text, _toelichting text, _beeindigen boolean DEFAULT true, _polis_meenemen boolean DEFAULT false, _einddatum date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.ondernemingen; v_naar uuid := _naar; v_opv uuid; v_stop jsonb; v_c uuid[]; v_p uuid[]; v_notitie uuid; v_naam text;
  v_mee boolean := coalesce(_polis_meenemen,false) AND _soort = 'rechtsvormwijziging'; v_contract_mee boolean := false; v_mee_res jsonb;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _van;
  IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF _ingangsdatum IS NULL THEN RAISE EXCEPTION 'ingangsdatum is verplicht'; END IF;
  IF _soort NOT IN ('rechtsvormwijziging','overname','overig') THEN RAISE EXCEPTION 'ongeldige soort'; END IF;
  IF v_naar IS NULL THEN
    IF length(btrim(coalesce(_naam,''))) < 2 THEN RAISE EXCEPTION 'naam nieuwe onderneming is verplicht'; END IF;
    IF nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),'') IS NOT NULL AND length(regexp_replace(_kvk,'\D','','g')) <> 8 THEN RAISE EXCEPTION 'KvK-nummer moet 8 cijfers zijn'; END IF;
    INSERT INTO public.ondernemingen (naam, kvk, rechtsvorm, is_test, bron, branche, sector)
    VALUES (btrim(_naam), nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),''), nullif(btrim(coalesce(_rechtsvorm,'')),''), o.is_test, 'ondernemingswijziging', o.branche, o.sector)
    RETURNING id INTO v_naar;
  ELSIF v_naar = _van THEN RAISE EXCEPTION 'kies een andere onderneming';
  END IF;
  SELECT naam INTO v_naam FROM public.ondernemingen WHERE id = v_naar;
  v_contract_mee := _soort = 'rechtsvormwijziging'
    AND EXISTS (SELECT 1 FROM public.klant_contracten c WHERE c.onderneming_id = _van AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle') AND (c.eind_datum IS NULL OR c.eind_datum >= _ingangsdatum))
    AND NOT EXISTS (SELECT 1 FROM public.klant_contracten c WHERE c.onderneming_id = v_naar AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle') AND (c.eind_datum IS NULL OR c.eind_datum >= _ingangsdatum));
  INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test)
  VALUES (_van, v_naar, _ingangsdatum, _soort, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), o.is_test) RETURNING id INTO v_opv;
  INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT persoon_id, v_naar FROM public.persoon_onderneming WHERE onderneming_id = _van ON CONFLICT DO NOTHING;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('onderneming_opvolging', v_opv, 'ondernemingswijziging', 'naar_onderneming_id', _van::text, v_naar::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('ingangsdatum', _ingangsdatum, 'soort', _soort, 'beeindigen', _beeindigen, 'polis_meenemen', v_mee, 'contract_meenemen', v_contract_mee));
  v_notitie := public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
    'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce(E'\nToelichting: ' || nullif(btrim(coalesce(_toelichting,'')),''), ''),
    jsonb_build_object('opvolging_id', v_opv, 'naar_onderneming_id', v_naar));
  IF _beeindigen THEN
    SELECT array_agg(id) INTO v_c FROM public.klant_contracten WHERE onderneming_id = _van AND status IN ('actief','loopt_af','einddatum_controle') AND (eind_datum IS NULL OR eind_datum > coalesce(_einddatum, _ingangsdatum - 1))
      AND NOT (v_contract_mee AND product = 'bav_avb');
    IF NOT v_mee THEN SELECT array_agg(id) INTO v_p FROM public.policies WHERE onderneming_id = _van AND status = 'geldig'; END IF;
    IF coalesce(array_length(v_c,1),0) + coalesce(array_length(v_p,1),0) > 0 THEN
      v_stop := public.crm_beeindig(_van, coalesce(v_c,'{}'), coalesce(v_p,'{}'), coalesce(_einddatum, _ingangsdatum - 1), 'ondernemingswijziging',
        'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce('. ' || nullif(btrim(coalesce(_toelichting,'')),''), ''));
    END IF;
  END IF;
  IF v_contract_mee THEN
    v_mee_res := public.contract_meenemen_kern(v_opv, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()),
      (SELECT nullif(btrim(coalesce(full_name,'')),'') FROM public.profiles WHERE id = auth.uid()));
  END IF;
  DECLARE v_nieuw public.ondernemingen; v_had boolean; BEGIN
    SELECT * INTO v_nieuw FROM public.ondernemingen WHERE id = v_naar;
    v_had := EXISTS (SELECT 1 FROM public.klant_contracten WHERE onderneming_id = _van) OR EXISTS (SELECT 1 FROM public.policies WHERE onderneming_id = _van);
    IF NOT v_mee AND NOT v_contract_mee AND (v_nieuw.kvk IS DISTINCT FROM o.kvk OR v_had) THEN
      INSERT INTO public.crm_taken (soort, team, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
      VALUES ('nieuwe_aanvraag_nodig', 'verzekering', v_naar,
        'Nieuwe aanvraag nodig: ' || o.naam || ' gaat verder als ' || v_nieuw.naam || ' (KvK ' || coalesce(v_nieuw.kvk,'onbekend') || ') per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '. Polis kan niet worden overgezet.',
        jsonb_build_object('opvolging_id', v_opv, 'van_onderneming_id', _van, 'oude_kvk', o.kvk, 'nieuwe_kvk', v_nieuw.kvk),
        auth.uid(), coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()),'teamlid'), o.is_test OR v_nieuw.is_test);
    END IF;
  END;
  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar, 'opvolging_id', v_opv, 'notitie_id', v_notitie, 'stop', v_stop, 'polis_meenemen', v_mee, 'contract_meenemen', v_mee_res);
END $function$;
REVOKE ALL ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean, date) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.rechtsvormwijziging_goedkeuren(_aanvraag uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a public.klant_service_aanvragen; d jsonb; n jsonb; v_van uuid; v_naar uuid; v_ingang date; v_eind date; v_res jsonb; v_kop uuid;
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT (public.is_team_member(auth.uid()) AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag FOR UPDATE;
  IF a.id IS NULL OR a.type <> 'rechtsvormwijziging' THEN RAISE EXCEPTION 'verzoek niet gevonden'; END IF;
  IF a.status NOT IN ('nieuw','in_behandeling') OR a.details ? 'goedgekeurd' THEN RAISE EXCEPTION 'verzoek is al afgehandeld'; END IF;
  d := a.details; n := d->'nieuw'; v_van := a.onderneming_id;
  v_ingang := (d->>'ingangsdatum')::date; v_eind := (d->>'einddatum')::date;
  IF v_van IS NULL THEN RAISE EXCEPTION 'huidige onderneming onbekend'; END IF;
  IF v_ingang IS NULL OR v_eind IS NULL THEN RAISE EXCEPTION 'einddatum en ingangsdatum zijn verplicht'; END IF;
  -- Besluit Boy 12-11-2026 12:11: overlap en gat toegestaan; einde niet voor de oorspronkelijke ingangsdatum.
  IF v_eind < coalesce((SELECT p.start_date FROM public.policies p WHERE p.id = (d->>'polis_id')::uuid), v_eind) THEN
    RAISE EXCEPTION 'einddatum ligt voor de oorspronkelijke ingangsdatum'; END IF;
  SELECT id INTO v_naar FROM public.ondernemingen WHERE kvk = n->>'kvk' AND samengevoegd_naar IS NULL AND id <> v_van AND NOT is_test ORDER BY created_at LIMIT 1;
  v_res := public.crm_ondernemingswijziging(v_van, v_naar, n->>'naam', n->>'kvk', n->>'rechtsvorm', v_ingang, 'rechtsvormwijziging',
    'Zelfservice Mijn ZP, verzoek ' || left(a.id::text, 8) || coalesce(', machtiging ' || (d->>'mandaatkenmerk'), ''), true, true, v_eind);
  v_naar := (v_res->>'naar_onderneming_id')::uuid;
  UPDATE public.ondernemingen SET straat = coalesce(straat, n->>'straat'), huisnummer = coalesce(huisnummer, n->>'huisnummer'),
    postcode = coalesce(postcode, n->>'postcode'), plaats = coalesce(plaats, n->>'plaats'), rechtsvorm = coalesce(rechtsvorm, n->>'rechtsvorm')
  WHERE id = v_naar;
  INSERT INTO public.onderneming_koppelingen (vorige_onderneming_id, nieuwe_onderneming_id, reden, vastgelegd_door, is_test)
  VALUES (v_van, v_naar, 'Rechtsvormwijziging via Mijn ZP, verzoek ' || left(a.id::text, 8), auth.uid(), a.is_test)
  ON CONFLICT (vorige_onderneming_id, nieuwe_onderneming_id) DO NOTHING RETURNING id INTO v_kop;
  UPDATE public.klant_service_aanvragen SET status = 'in_behandeling', behandeld_door = auth.uid(), behandeld_op = now(),
    details = details || jsonb_build_object('goedgekeurd', jsonb_build_object('op', now(), 'door', auth.uid(), 'naar_onderneming_id', v_naar, 'opvolging_id', v_res->>'opvolging_id', 'koppeling_id', v_kop))
  WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'rechtsvormwijziging_goedgekeurd', 'onderneming_id', v_van::text, v_naar::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('ingangsdatum', v_ingang, 'einddatum', v_eind, 'polis_id', d->>'polis_id', 'koppeling_id', v_kop));
  RETURN jsonb_build_object('naar_onderneming_id', v_naar, 'opvolging_id', v_res->>'opvolging_id', 'polis_id', d->>'polis_id', 'ingangsdatum', v_ingang);
END $function$;