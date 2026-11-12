-- Bestaande klant bij een dubbele aanvraag (spoed Boy/Ellen 12-11-2026).
-- Sluit alleen af als hetzelfde KvK al een lopend BAV+AVB-contract en een geldige polis heeft.
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'samengevoegd';

CREATE OR REPLACE FUNCTION public._bestaande_klant_bij_aanvraag(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  SELECT o.id AS onderneming_id, o.naam, c.id AS contract_id, p.id AS policy_id, p.certificate_number
  INTO v
  FROM public.leads l
  JOIN public.ondernemingen o
    ON regexp_replace(coalesce(o.kvk,''),'\D','','g') = regexp_replace(coalesce(l.kvk_nummer,''),'\D','','g')
   AND o.samengevoegd_naar IS NULL
   AND o.is_test = l.is_test
  JOIN public.klant_contracten c
    ON c.onderneming_id = o.id
   AND c.product = 'bav_avb'
   AND c.status = 'actief'
   AND c.begin_datum <= v_vandaag
   AND (c.eind_datum IS NULL OR c.eind_datum >= v_vandaag)
   AND c.is_test = l.is_test
  JOIN public.policies p
    ON p.onderneming_id = o.id
   AND p.status = 'geldig'
   AND p.start_date <= v_vandaag
   AND p.is_test = l.is_test
   AND nullif(btrim(p.certificate_number),'') IS NOT NULL
  WHERE l.id = _lead_id
    AND l.type = 'verzekering_aanvraag'
    AND regexp_replace(coalesce(l.kvk_nummer,''),'\D','','g') ~ '^[0-9]{8}$'
  ORDER BY o.created_at, c.begin_datum DESC, p.start_date DESC, p.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'onderneming_id', v.onderneming_id,
    'naam', v.naam,
    'contract_id', v.contract_id,
    'policy_id', v.policy_id,
    'polisnummer', v.certificate_number
  );
END $$;

CREATE OR REPLACE FUNCTION public.bestaande_klant_bij_aanvraag(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.a19_team();
  RETURN public._bestaande_klant_bij_aanvraag(_lead_id);
END $$;

CREATE OR REPLACE FUNCTION public.aanvraag_bestaande_klant_afsluiten(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.leads;
  b jsonb;
  v_ond uuid;
  v_reden text;
  v_notitie uuid;
BEGIN
  PERFORM public.a19_team();
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF l.id IS NULL OR l.type <> 'verzekering_aanvraag' THEN
    RAISE EXCEPTION 'Aanvraag niet gevonden' USING ERRCODE = '22023';
  END IF;
  b := public._bestaande_klant_bij_aanvraag(_lead_id);
  IF b IS NULL THEN
    RAISE EXCEPTION 'Geen lopend BAV+AVB-contract en geldige polis gevonden bij hetzelfde KvK-nummer' USING ERRCODE = '23514';
  END IF;
  v_ond := (b->>'onderneming_id')::uuid;
  IF l.status = 'samengevoegd' THEN
    RETURN jsonb_build_object('ok', true, 'al_afgesloten', true, 'onderneming_id', v_ond, 'polisnummer', b->>'polisnummer');
  END IF;
  IF l.geactiveerd_op IS NOT NULL OR l.status IN ('actief','gepauzeerd','opgezegd') THEN
    RAISE EXCEPTION 'Deze aanvraag heeft zelf een actieve polis en kan niet als dubbel worden afgesloten' USING ERRCODE = '23514';
  END IF;
  IF l.exact_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Er is al een factuur aan deze aanvraag gekoppeld; eerst door de administratie beoordelen' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.policies p WHERE p.lead_id = l.id AND p.status = 'geldig') THEN
    RAISE EXCEPTION 'Er is al een certificaat aan deze aanvraag gekoppeld; niet als dubbel afsluiten' USING ERRCODE = '23514';
  END IF;
  IF l.gekoppeld_onderneming_id IS NOT NULL AND public.onderneming_hoofdkaart(l.gekoppeld_onderneming_id) <> v_ond THEN
    RAISE EXCEPTION 'De aanvraag is al aan een andere klantkaart gekoppeld' USING ERRCODE = '23514';
  END IF;

  IF l.gekoppeld_onderneming_id IS NULL THEN
    PERFORM public.lead_klant_koppelen('leads', l.id, v_ond, NULL,
      'Gekoppeld bij afsluiten als bestaande klant; geen nieuwe activatie.');
    SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  END IF;

  v_reden := 'Bestaande klant: contract en polis ' || (b->>'polisnummer') || ' lopen al. Dubbele aanvraag afgesloten zonder nieuwe activatie.';
  PERFORM set_config('zp.a19_rpc', '1', true);
  PERFORM set_config('zp.bestaande_klant_rpc', '1', true);
  PERFORM set_config('app.afrond_toelichting', v_reden, true);
  UPDATE public.leads
  SET status = 'samengevoegd',
      converted_at = coalesce(converted_at, now()),
      aanvraag_afgerond_op = now(),
      aanvraag_afgerond_reden = v_reden,
      aanvraag_afgerond_door = auth.uid()
  WHERE id = l.id;

  v_notitie := public.crm_notitie_toevoegen(v_ond, l.gekoppeld_persoon_id, 'notitie',
    'Dubbele aanvraag afgesloten als bestaande klant. Het lopende contract en certificaat ' || (b->>'polisnummer') ||
    ' zijn ongewijzigd gebleven. Bij dit afsluiten zijn geen nieuwe polis, geen nieuw contract, geen factuur en geen klantmail aangemaakt.',
    jsonb_build_object('soort', 'bestaande_klant_dubbele_aanvraag', 'lead_id', l.id, 'contract_id', b->>'contract_id', 'policy_id', b->>'policy_id'));

  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('leads', l.id, 'aanvraag_bestaande_klant_afgesloten', 'status', l.status::text, 'samengevoegd', auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', v_ond, 'contract_id', b->>'contract_id', 'policy_id', b->>'policy_id',
      'polisnummer', b->>'polisnummer', 'geactiveerd_op_ongewijzigd', l.geactiveerd_op, 'crm_notitie_id', v_notitie));

  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, lead_id, klant_email, is_test)
  VALUES ('aanvraag_bestaande_klant_afgesloten', v_reden, auth.uid(), l.id, lower(l.email), l.is_test);

  RETURN jsonb_build_object('ok', true, 'onderneming_id', v_ond, 'polisnummer', b->>'polisnummer', 'notitie_id', v_notitie);
END $$;

CREATE OR REPLACE FUNCTION public.guard_lead_afgerond()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'samengevoegd' AND NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(current_setting('zp.bestaande_klant_rpc', true),'') <> '1' THEN
    RAISE EXCEPTION 'Status samengevoegd alleen via Afsluiten als bestaande klant' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord','samengevoegd') AND NEW.status IS DISTINCT FROM OLD.status
     AND OLD.type = 'verzekering_aanvraag'
     AND (OLD.geactiveerd_op IS NOT NULL OR OLD.status IN ('actief','gepauzeerd','opgezegd','klant'))
     AND coalesce(current_setting('zp.bestaande_klant_rpc', true),'') <> '1' THEN
    RAISE EXCEPTION 'Niet toegestaan: deze aanvraag heeft een polis; afsluiten zou de polisstatus overschrijven.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_lead_afgerond()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_naam text; v_toel text := nullif(btrim(current_setting('app.afrond_toelichting', true)), '');
  v_dicht boolean := NEW.status::text IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord','samengevoegd');
  v_was boolean := OLD.status::text IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord','samengevoegd');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (v_dicht OR v_was) THEN
    SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email, is_test)
    VALUES (CASE WHEN v_dicht THEN 'lead_afgerond' ELSE 'lead_heropend' END,
      CASE NEW.status::text WHEN 'afgerond' THEN 'Afgerond' WHEN 'klant_geworden' THEN 'Afgesloten: Klant geworden'
        WHEN 'geen_interesse' THEN 'Afgesloten: Geen interesse' WHEN 'vraag_beantwoord' THEN 'Afgesloten: Vraag beantwoord'
        WHEN 'samengevoegd' THEN 'Afgesloten als bestaande klant (samengevoegd)'
        ELSE 'Heropend, status ' || NEW.status::text END || coalesce('. Toelichting: ' || v_toel, ''),
      auth.uid(), coalesce(v_naam, CASE WHEN auth.uid() IS NULL THEN 'systeem' ELSE 'teamlid' END), NEW.id, lower(NEW.email), NEW.is_test);
  END IF;
  RETURN NEW;
END $$;

DO $do$
DECLARE d text; oud text := '''afgerond'',''klant_geworden'',''geen_interesse'',''vraag_beantwoord'''; nieuw text := '''afgerond'',''klant_geworden'',''geen_interesse'',''vraag_beantwoord'',''samengevoegd''';
BEGIN
  d := pg_get_functiondef('public.guard_a19_koppeling()'::regprocedure);
  IF position('samengevoegd' IN d) = 0 THEN
    d := replace(d, oud, nieuw);
    IF position('samengevoegd' IN d) = 0 THEN RAISE EXCEPTION 'guard_a19_koppeling niet aangepast'; END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef('public.mijn_acties_vandaag_basis(boolean)'::regprocedure);
  IF position('samengevoegd' IN d) = 0 THEN
    d := replace(d, oud, nieuw);
    IF position('samengevoegd' IN d) = 0 THEN RAISE EXCEPTION 'mijn_acties_vandaag_basis niet aangepast'; END IF;
    EXECUTE d;
  END IF;
END $do$;

REVOKE ALL ON FUNCTION public._bestaande_klant_bij_aanvraag(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bestaande_klant_bij_aanvraag(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aanvraag_bestaande_klant_afsluiten(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._bestaande_klant_bij_aanvraag(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bestaande_klant_bij_aanvraag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aanvraag_bestaande_klant_afsluiten(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._ts_bestaande_klant()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a';
  lead_id constant uuid := '7e570000-0000-4000-8000-0000000001d1';
  adm constant uuid := '5d591f12-d010-4640-ae68-2b4f58953320';
  c jsonb := '[]'; k uuid; p uuid; r jsonb; b jsonb; n1 bigint; n2 bigint; v_kvk text;
BEGIN
  SELECT kvk INTO v_kvk FROM public.ondernemingen WHERE id = ond_a;
  k := public._ts_contract(ond_a, current_date - 100);
  p := public._ts_polis(ond_a, current_date - 100, 'ZPBAVTSBEST');
  INSERT INTO public.leads (id, type, status, voornaam, achternaam, email, bedrijfsnaam, kvk_nummer, gekozen_pakket, exact_account_id, is_test)
  VALUES (lead_id, 'verzekering_aanvraag', 'klant', 'Test', 'Dubbel', 'test+dubbel@zpzaken.nl', 'Testpersoon dubbele aanvraag', v_kvk, 'jaarlijks', 'deels-geactiveerd-test', true);
  PERFORM public._ts_sessie(adm, 'aal2');
  b := public.bestaande_klant_bij_aanvraag(lead_id);
  c := c || public._ts_c('bestaande polis herkend', 'ZPBAVTSBEST', b->>'polisnummer');
  SELECT count(*) INTO n1 FROM public.klant_contracten WHERE onderneming_id = ond_a;
  r := public.aanvraag_bestaande_klant_afsluiten(lead_id);
  SELECT count(*) INTO n2 FROM public.klant_contracten WHERE onderneming_id = ond_a;
  c := c || public._ts_c('status samengevoegd', 'samengevoegd', (SELECT status::text FROM public.leads WHERE id = lead_id))
       || public._ts_c('geactiveerd_op blijft leeg', NULL, (SELECT geactiveerd_op::text FROM public.leads WHERE id = lead_id))
       || public._ts_c('lead gekoppeld aan bestaande klant', ond_a::text, (SELECT gekoppeld_onderneming_id::text FROM public.leads WHERE id = lead_id))
       || public._ts_c('aanvraag afgesloten', 'true', (SELECT (aanvraag_afgerond_op IS NOT NULL AND aanvraag_afgerond_door = adm)::text FROM public.leads WHERE id = lead_id))
       || public._ts_c('bestaand Exact-spoor niet overschreven', 'deels-geactiveerd-test', (SELECT exact_account_id FROM public.leads WHERE id = lead_id))
       || public._ts_c('geen tweede contract', n1::text, n2::text)
       || public._ts_c('geen nieuw certificaat', '0', (SELECT count(*)::text FROM public.policies WHERE lead_id = lead_id))
       || public._ts_c('CRM-notitie op klantkaart', '1', (SELECT count(*)::text FROM public.crm_notities WHERE onderneming_id = ond_a AND details->>'lead_id' = lead_id::text AND details->>'soort' = 'bestaande_klant_dubbele_aanvraag'))
       || public._ts_c('auditregel aanwezig', '1', (SELECT count(*)::text FROM public.sensitive_audit_log WHERE target_table = 'leads' AND target_id = lead_id AND actie = 'aanvraag_bestaande_klant_afgesloten'))
       || public._ts_c('geen klantmail of uitnodiging', '0', (SELECT count(*)::text FROM public.lead_notification_log WHERE lead_id = lead_id));
  r := public.aanvraag_bestaande_klant_afsluiten(lead_id);
  c := c || public._ts_c('herhaling is idempotent', 'true', r->>'al_afgesloten')
       || public._ts_c('geen dubbele CRM-notitie', '1', (SELECT count(*)::text FROM public.crm_notities WHERE onderneming_id = ond_a AND details->>'lead_id' = lead_id::text AND details->>'soort' = 'bestaande_klant_dubbele_aanvraag'));
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_bestaande_klant() FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.test_scenario(text)'::regprocedure);
  IF position('_ts_bestaande_klant' IN d) = 0 THEN
    d := replace(d, $r$'exact_adres_wachtrij','incasso_cyclus_uit','incasso_contact_betaald','review_betaalachterstand'] || vitest$r$, $r$'exact_adres_wachtrij','incasso_cyclus_uit','incasso_contact_betaald','review_betaalachterstand','bestaande_klant_dubbele_aanvraag'] || vitest$r$);
    d := replace(d, $r$    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$, $r$    ELSIF p_naam = 'bestaande_klant_dubbele_aanvraag' THEN
      c := c || public._ts_bestaande_klant();
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$);
    IF position('_ts_bestaande_klant' IN d) = 0 OR position('bestaande_klant_dubbele_aanvraag''] || vitest' IN d) = 0 THEN
      RAISE EXCEPTION 'test_scenario kon niet worden uitgebreid';
    END IF;
    EXECUTE d;
  END IF;
END $do$;
REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_scenario(text) TO service_role;
