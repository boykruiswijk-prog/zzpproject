-- Scenario-runner (besluit Boy 12-11-2026 12:16). Bouwt per scenario testdata op de vaste testpersoon, roept de echte RPC's aan
-- met een gesimuleerde sessie en draait daarna alles terug via een interne exception. Alleen service_role/postgres.

CREATE OR REPLACE FUNCTION public._ts_c(_naam text, _verwacht text, _gekregen text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('naam', _naam, 'verwacht', _verwacht, 'gekregen', _gekregen, 'ok', _verwacht IS NOT DISTINCT FROM _gekregen)
$$;

CREATE OR REPLACE FUNCTION public._ts_sessie(_uid uuid, _aal text DEFAULT 'aal2')
RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated', 'aal', _aal)::text, true);
  SELECT set_config('request.jwt.claim.sub', _uid::text, true);
$$;

CREATE OR REPLACE FUNCTION public._ts_tel()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t text; uit jsonb := '{}'; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['klant_contracten','policies','klant_service_aanvragen','crm_notities','lead_notes','crm_taken','sensitive_audit_log',
    'ondernemingen','onderneming_opvolging','onderneming_koppelingen','persoon_onderneming','factuur_planning','factuur_credit_planning',
    'email_send_log','lead_notification_log','wijzigingsmeldingen','activiteiten_log'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    uit := uit || jsonb_build_object(t, n);
  END LOOP;
  RETURN uit;
END $$;

CREATE OR REPLACE FUNCTION public._ts_contract(_ond uuid, _begin date, _product text DEFAULT 'bav_avb')
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.klant_contracten (onderneming_id, bron, bron_rij, type, itemcode, product, cyclus, status, begin_datum, factureren_vanaf,
    volgende_factuurdatum, bedrag_per_periode, is_test)
  VALUES (_ond, 'test_scenario', (floor(random() * 1e9))::int, CASE WHEN _product LIKE 'lidmaatschap%' THEN 'lidmaatschap' ELSE 'verzekering' END,
    CASE WHEN _product LIKE 'lidmaatschap%' THEN 'LIDLIGHT' ELSE 'BAV' END, _product, 'maand', 'actief', _begin, _begin, _begin, 50, true)
  RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public._ts_polis(_ond uuid, _start date, _nummer text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.policies (certificate_number, certificate_holder, insured_name, start_date, profession, status, onderneming_id, is_test)
  VALUES (_nummer, 'Testpersoon ZP Zaken', 'Testpersoon ZP Zaken', _start, 'Testberoep', 'geldig', _ond, true)
  RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public._ts_fout(_sql text)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  EXECUTE _sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public._ts_rechtsvorm_aanvraag(_van uuid, _eind date, _ingang date, _polis uuid, _rechtsvorm text, _kvk text, _naam text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.klant_service_aanvragen (type, status, voornaam, achternaam, email, telefoon, polisnummer, user_id, onderneming_id, is_test, geverifieerd, details)
  VALUES ('rechtsvormwijziging', 'nieuw', 'Testpersoon', 'ZP Zaken', 'test+testpersoon@zpzaken.nl', '-', 'ZPBAVTEST', '7e570000-0000-4000-8000-00000000000c', _van, true, true,
    jsonb_build_object('polis_id', _polis, 'einddatum', _eind, 'ingangsdatum', _ingang,
      'nieuw', jsonb_build_object('naam', _naam, 'kvk', _kvk, 'rechtsvorm', _rechtsvorm, 'straat', 'Teststraat', 'huisnummer', '1', 'postcode', '1234 AB', 'plaats', 'Teststad', 'land', 'Nederland')))
  RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.test_scenario(p_naam text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_uid constant uuid := '5d591f12-d010-4640-ae68-2b4f58953320';
  klant_uid constant uuid := '7e570000-0000-4000-8000-00000000000c';
  ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a';
  ond_b constant uuid := '7e570000-0000-4000-8000-00000000000b';
  vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  c jsonb := '[]'; s text; namen text[]; uitk jsonb := '[]'; r jsonb; voor jsonb; na jsonb;
  k uuid; k2 uuid; p uuid; a uuid; h uuid; r1 uuid; r2 uuid; res jsonb; f text; x text; n1 bigint; n2 bigint; naar uuid; d date;
  vitest constant text[] := ARRAY['maatwerk_bouw','maatwerk_zorg','maatwerk_techniek','maatwerk_overig','credit_afas_los','credit_ontbreekt_relatie'];
BEGIN
  IF p_naam = 'alle' THEN
    namen := ARRAY['ingangsdatum_ok','ingangsdatum_na_factuur','ingangsdatum_beeindigd','ingangsdatum_te_ver','ingangsdatum_reden_kort',
      'label_nog_niet_gefactureerd','rechtsvorm_aansluitend','rechtsvorm_overlap','rechtsvorm_gat','rechtsvorm_omgekeerd','rechtsvorm_eind_voor_ingang',
      'rechtsvorm_koppelen_admin','crm_reactie','crm_reactie_op_reactie','crm_intrekken','crm_aantal_ongewijzigd','planner_dryrun_testpersoon'] || vitest;
    voor := public._ts_tel();
    FOREACH s IN ARRAY namen LOOP uitk := uitk || public.test_scenario(s); END LOOP;
    na := public._ts_tel();
    RETURN jsonb_build_object('scenario', 'alle',
      'geslaagd', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(uitk) e WHERE (e->>'geslaagd') = 'false') AND voor = na,
      'aantal', jsonb_array_length(uitk),
      'geslaagd_sql', (SELECT count(*) FROM jsonb_array_elements(uitk) e WHERE (e->>'geslaagd') = 'true'),
      'mislukt', (SELECT coalesce(jsonb_agg(e->'scenario'), '[]') FROM jsonb_array_elements(uitk) e WHERE (e->>'geslaagd') = 'false'),
      'via_vitest', (SELECT coalesce(jsonb_agg(e->'scenario'), '[]') FROM jsonb_array_elements(uitk) e WHERE e->>'soort' = 'vitest'),
      'rijen_voor', voor, 'rijen_na', na, 'nul_rijen_achtergebleven', voor = na,
      'scenarios', uitk);
  END IF;

  IF p_naam = ANY (vitest) THEN
    RETURN jsonb_build_object('scenario', p_naam, 'soort', 'vitest', 'geslaagd', NULL,
      'controles', jsonb_build_array(jsonb_build_object('naam', 'logica staat in TypeScript; draai: bunx vitest run src/test/scenarios1211.test.ts -t ' || p_naam, 'ok', NULL)));
  END IF;

  voor := public._ts_tel();
  BEGIN
    PERFORM public._ts_sessie(admin_uid);

    IF p_naam LIKE 'ingangsdatum_%' THEN
      k := public._ts_contract(ond_a, '2026-12-01');
      p := public._ts_polis(ond_a, '2026-12-01', 'ZPBAVTEST01');
    END IF;

    IF p_naam = 'ingangsdatum_ok' THEN
      SELECT count(*) INTO n1 FROM (SELECT 1 FROM email_send_log UNION ALL SELECT 1 FROM lead_notification_log) z;
      res := public.contract_wijzig_ingangsdatum(k, '2026-11-30', 'Scenario: klant wil een dag eerder starten');
      c := c || public._ts_c('contract begin_datum', '2026-11-30', (SELECT begin_datum::text FROM klant_contracten WHERE id = k))
             || public._ts_c('contract gefactureerd_tm', '2026-11-29', (SELECT gefactureerd_tm::text FROM klant_contracten WHERE id = k))
             || public._ts_c('contract factureren_vanaf', '2026-11-30', (SELECT factureren_vanaf::text FROM klant_contracten WHERE id = k))
             || public._ts_c('polis start_date', '2026-11-30', (SELECT start_date::text FROM policies WHERE id = p))
             || public._ts_c('certificaatnummer ongewijzigd', 'ZPBAVTEST01', (SELECT certificate_number FROM policies WHERE id = p))
             || public._ts_c('polis in resultaat', 'true', ((res->'policy_ids') ? p::text)::text);
      SELECT count(*) INTO n2 FROM (SELECT 1 FROM email_send_log UNION ALL SELECT 1 FROM lead_notification_log) z;
      c := c || public._ts_c('geen mail', n1::text, n2::text);
    ELSIF p_naam = 'ingangsdatum_na_factuur' THEN
      INSERT INTO factuur_planning (klant_contract_id, periode_start, periode_eind, aantal, bedrag_per_periode, bedrag, exact_account_id, exact_item_id, planningssleutel, status, is_test)
      VALUES (k, '2026-12-01', '2026-12-31', 1, 50, 50, 'test', 'test', 'TEST-' || k, 'concept_aangemaakt', true);
      f := public._ts_fout(format('SELECT public.contract_wijzig_ingangsdatum(%L, %L, %L)', k, '2026-11-30', 'Scenario: na factuur wijzigen'));
      c := c || public._ts_c('geblokkeerd met melding', 'Voor dit contract is al een factuur gepland of gemaakt. Wijzig de ingangsdatum via de administratie.', f)
             || public._ts_c('begin_datum ongewijzigd', '2026-12-01', (SELECT begin_datum::text FROM klant_contracten WHERE id = k));
    ELSIF p_naam = 'ingangsdatum_beeindigd' THEN
      UPDATE klant_contracten SET eind_datum = '2026-12-31', status = 'loopt_af' WHERE id = k;
      f := public._ts_fout(format('SELECT public.contract_wijzig_ingangsdatum(%L, %L, %L)', k, '2026-11-30', 'Scenario: beeindigd contract'));
      c := c || public._ts_c('geblokkeerd met melding', 'Dit contract is beëindigd. De ingangsdatum kan niet meer worden gewijzigd.', f);
    ELSIF p_naam = 'ingangsdatum_te_ver' THEN
      f := public._ts_fout(format('SELECT public.contract_wijzig_ingangsdatum(%L, %L, %L)', k, (vandaag + 400), 'Scenario: te ver in de toekomst'));
      c := c || public._ts_c('geblokkeerd met melding', 'De nieuwe ingangsdatum ligt meer dan 1 jaar in de toekomst.', f);
      f := public._ts_fout(format('SELECT public.contract_wijzig_ingangsdatum(%L, %L, %L)', k, (vandaag - 61), 'Scenario: te ver in het verleden'));
      c := c || public._ts_c('verleden geblokkeerd', 'De nieuwe ingangsdatum ligt meer dan 60 dagen in het verleden.', f);
    ELSIF p_naam = 'ingangsdatum_reden_kort' THEN
      f := public._ts_fout(format('SELECT public.contract_wijzig_ingangsdatum(%L, %L, %L)', k, '2026-11-30', 'kort'));
      c := c || public._ts_c('geblokkeerd met melding', 'Geef een reden van minimaal 10 tekens.', f);
    ELSIF p_naam = 'label_nog_niet_gefactureerd' THEN
      k := public._ts_contract(ond_a, '2026-12-01');
      res := public.contract_ingangsdatum_info(k);
      c := c || public._ts_c('gefactureerd_tm leeg', NULL, res->>'gefactureerd_tm')
             || public._ts_c('geen verstuurde factuur', 'false', res->>'verstuurde_factuur')
             || public._ts_c('label = Nog niet gefactureerd (start 01-12-2026)', 'true',
                  ((res->>'begin_datum') IS NOT NULL AND (res->>'gefactureerd_tm') IS NULL AND NOT (res->>'verstuurde_factuur')::boolean)::text);
      UPDATE klant_contracten SET gefactureerd_tm = '2026-12-31' WHERE id = k;
      res := public.contract_ingangsdatum_info(k);
      c := c || public._ts_c('na factureren: label Gefactureerd t/m', '2026-12-31', res->>'gefactureerd_tm');

    ELSIF p_naam IN ('rechtsvorm_aansluitend','rechtsvorm_overlap','rechtsvorm_gat','rechtsvorm_eind_voor_ingang') THEN
      k := public._ts_contract(ond_a, '2026-10-01');
      k2 := public._ts_contract(ond_a, '2026-10-01', 'lidmaatschap_light');
      p := public._ts_polis(ond_a, '2026-10-01', 'ZPBAVTEST02');
      d := CASE p_naam WHEN 'rechtsvorm_aansluitend' THEN '2026-11-30' WHEN 'rechtsvorm_overlap' THEN '2026-12-31' WHEN 'rechtsvorm_gat' THEN '2026-11-20' ELSE '2026-09-01' END;
      a := public._ts_rechtsvorm_aanvraag(ond_a, d, '2026-12-01', p, 'BV', '99000192', 'Testpersoon ZP Zaken BV scenario');
      f := public._ts_fout(format('SELECT public.rechtsvormwijziging_goedkeuren(%L)', a));
      IF p_naam = 'rechtsvorm_eind_voor_ingang' THEN
        c := c || public._ts_c('geblokkeerd', 'einddatum ligt voor de oorspronkelijke ingangsdatum', f);
      ELSE
        c := c || public._ts_c('niet geblokkeerd', NULL, f);
        naar := (SELECT (details->'goedgekeurd'->>'naar_onderneming_id')::uuid FROM klant_service_aanvragen WHERE id = a);
        c := c || public._ts_c('verzoek in behandeling', 'in_behandeling', (SELECT status FROM klant_service_aanvragen WHERE id = a))
               || public._ts_c('overig contract stopt exact op opgegeven einddatum', d::text, (SELECT eind_datum::text FROM klant_contracten WHERE id = k2))
               || public._ts_c('BAV + AVB-contract gaat mee naar nieuwe onderneming', naar::text, (SELECT onderneming_id::text FROM klant_contracten WHERE id = k))
               || public._ts_c('ondernemingen gekoppeld', '1', (SELECT count(*)::text FROM onderneming_koppelingen WHERE vorige_onderneming_id = ond_a AND nieuwe_onderneming_id = naar))
               || public._ts_c('nieuwe onderneming is test', 'true', (SELECT is_test::text FROM ondernemingen WHERE id = naar));
        IF p_naam = 'rechtsvorm_gat' THEN
          c := c || public._ts_c('gat: waarschuwing in scherm (datumsMelding, vitest), server blokkeert niet', NULL, f);
        END IF;
        PERFORM public._ts_sessie(klant_uid, 'aal1');
        c := c || public._ts_c('klant ziet eigen verzoek', '1', (SELECT count(*)::text FROM public.mijn_rechtsvormwijzigingen() m WHERE m.id = a));
      END IF;
    ELSIF p_naam = 'rechtsvorm_omgekeerd' THEN
      k := public._ts_contract(ond_b, '2026-10-01');
      p := public._ts_polis(ond_b, '2026-10-01', 'ZPBAVTEST03');
      a := public._ts_rechtsvorm_aanvraag(ond_b, '2026-11-30', '2026-12-01', p, 'Eenmanszaak', '99000193', 'Testpersoon ZP Zaken scenario');
      f := public._ts_fout(format('SELECT public.rechtsvormwijziging_goedkeuren(%L)', a));
      naar := (SELECT (details->'goedgekeurd'->>'naar_onderneming_id')::uuid FROM klant_service_aanvragen WHERE id = a);
      c := c || public._ts_c('niet geblokkeerd', NULL, f)
             || public._ts_c('nieuwe rechtsvorm', 'Eenmanszaak', (SELECT rechtsvorm FROM ondernemingen WHERE id = naar))
             || public._ts_c('contract mee naar eenmanszaak', naar::text, (SELECT onderneming_id::text FROM klant_contracten WHERE id = k));
    ELSIF p_naam = 'rechtsvorm_koppelen_admin' THEN
      SELECT count(*) INTO n1 FROM onderneming_opvolging WHERE van_onderneming_id = ond_a;
      f := public._ts_fout(format('SELECT public.onderneming_koppel_vorige(%L, %L, %L)', ond_b, ond_a, 'kort'));
      c := c || public._ts_c('korte reden geblokkeerd', 'true', (f IS NOT NULL)::text);
      h := public.onderneming_koppel_vorige(ond_b, ond_a, 'Scenario: klant zegde op en vroeg nieuw aan als bv');
      c := c || public._ts_c('koppeling vastgelegd', '1', (SELECT count(*)::text FROM onderneming_koppelingen WHERE id = h AND vorige_onderneming_id = ond_a AND nieuwe_onderneming_id = ond_b));
      SELECT count(*) INTO n2 FROM onderneming_opvolging WHERE van_onderneming_id = ond_a;
      c := c || public._ts_c('geen opvolging (BAV-nummers blijven)', n1::text, n2::text);

    ELSIF p_naam IN ('crm_reactie','crm_reactie_op_reactie','crm_intrekken','crm_aantal_ongewijzigd') THEN
      SELECT count(*) INTO n1 FROM crm_notities WHERE NOT is_test;
      h := public.crm_notitie_toevoegen(ond_a, NULL, 'notitie', 'Scenario: hoofdnotitie');
      r1 := public.crm_reactie_toevoegen(h, 'Scenario: reactie');
      IF p_naam = 'crm_reactie' THEN
        c := c || public._ts_c('reactie hangt aan hoofdnotitie', h::text, (SELECT parent_id::text FROM crm_notities WHERE id = r1))
               || public._ts_c('reactie bij dezelfde onderneming', ond_a::text, (SELECT onderneming_id::text FROM crm_notities WHERE id = r1))
               || public._ts_c('reactie is test', 'true', (SELECT is_test::text FROM crm_notities WHERE id = r1));
      ELSIF p_naam = 'crm_reactie_op_reactie' THEN
        r2 := public.crm_reactie_toevoegen(r1, 'Scenario: reactie op reactie');
        c := c || public._ts_c('reactie op reactie hangt aan dezelfde hoofdnotitie', h::text, (SELECT parent_id::text FROM crm_notities WHERE id = r2));
      ELSIF p_naam = 'crm_intrekken' THEN
        f := public._ts_fout(format('SELECT public.crm_notitie_intrekken(%L, %L)', r1, 'x'));
        c := c || public._ts_c('reden te kort geblokkeerd', 'geef een reden op', f);
        PERFORM public.crm_notitie_intrekken(r1, 'Scenario: dubbel ingevoerd');
        c := c || public._ts_c('ingetrokken met reden', 'Scenario: dubbel ingevoerd', (SELECT intrek_reden FROM crm_notities WHERE id = r1))
               || public._ts_c('rij blijft bestaan', '1', (SELECT count(*)::text FROM crm_notities WHERE id = r1));
        f := public._ts_fout(format('UPDATE public.crm_notities SET parent_id = NULL WHERE id = %L', r1));
        c := c || public._ts_c('koppeling onveranderbaar', 'reactiekoppeling is onveranderbaar', f);
      ELSE
        SELECT count(*) INTO n2 FROM crm_notities WHERE NOT is_test;
        c := c || public._ts_c('aantal echte notities ongewijzigd', n1::text, n2::text);
      END IF;

    ELSIF p_naam = 'planner_dryrun_testpersoon' THEN
      k := public._ts_contract(ond_a, '2026-11-01');
      PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
      SELECT count(*) INTO n1 FROM public.facturatie_kandidaten('2026-11-01', '2027-01-31') fk WHERE fk.onderneming_id IN (ond_a, ond_b);
      c := c || public._ts_c('testpersoon niet in factuurplanning', '0', n1::text)
             || public._ts_c('creditplanning van testpersoon leeg', '0', (SELECT count(*)::text FROM factuur_credit_planning cp JOIN klant_contracten kc ON kc.id = cp.klant_contract_id WHERE kc.onderneming_id IN (ond_a, ond_b) AND NOT cp.is_test));
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02', MESSAGE = 'onbekend scenario: ' || p_naam;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0T01', MESSAGE = 'scenario klaar, terugdraaien';
  EXCEPTION
    WHEN SQLSTATE 'P0T01' THEN NULL;
    WHEN SQLSTATE 'P0T02' THEN RETURN jsonb_build_object('scenario', p_naam, 'geslaagd', false, 'controles', jsonb_build_array(public._ts_c('bekend scenario', p_naam, 'onbekend')));
    WHEN OTHERS THEN c := c || public._ts_c('onverwachte fout', NULL, SQLERRM);
  END;
  na := public._ts_tel();
  c := c || public._ts_c('0 nieuwe rijen na terugdraaien', voor::text, na::text);
  RETURN jsonb_build_object('scenario', p_naam, 'geslaagd', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c) e WHERE NOT (e->>'ok')::boolean), 'controles', c);
END $$;

REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_scenario(text) TO service_role;
REVOKE ALL ON FUNCTION public._ts_c(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_sessie(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_tel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_contract(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_polis(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_fout(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_rechtsvorm_aanvraag(uuid, date, date, uuid, text, text, text) FROM PUBLIC, anon, authenticated;