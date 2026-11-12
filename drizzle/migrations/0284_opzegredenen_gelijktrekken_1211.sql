-- Register "Opzegredenen gelijktrekken" (12-11-2026): één lijst met codes, bestaande opzeggingen ongewijzigd.
DO $mig$
DECLARE d text; o text;
BEGIN
  -- crm_beeindig: nieuwe codes erbij, oude codes blijven geldig voor interne aanroepen en historie.
  d := pg_get_functiondef('public.crm_beeindig'::regproc); o := d;
  d := replace(d, $a$IF _reden NOT IN ('opzegging_klant','eerdere_opzegging','ondernemingswijziging','wanbetaling','stoppen_onderneming','overig') THEN$a$,
    $a$IF _reden NOT IN ('stoppen_loondienst','wijzigen_entiteit','pensioen','geen_opdracht','overlijden','beeindiging_zp','overgestapt','anders','eerdere_opzegging','opzegging_klant','ondernemingswijziging','wanbetaling','stoppen_onderneming','overig') THEN$a$);
  d := replace(d, $a$v_label := CASE _reden WHEN 'opzegging_klant' THEN$a$,
    $a$v_label := CASE _reden WHEN 'stoppen_loondienst' THEN 'Stoppen ondernemen/loondienst' WHEN 'wijzigen_entiteit' THEN 'Wijzigen entiteit (BV, eenmanszaak..)'
    WHEN 'pensioen' THEN 'Pensioen' WHEN 'geen_opdracht' THEN '(Tijdelijk) geen opdracht' WHEN 'overlijden' THEN 'Overlijden'
    WHEN 'beeindiging_zp' THEN 'Beëindiging vanuit ZP' WHEN 'overgestapt' THEN 'Overgestapt' WHEN 'anders' THEN 'Andere reden (namelijk:)'
    WHEN 'opzegging_klant' THEN$a$);
  IF d = o OR strpos(d, 'beeindiging_zp') = 0 OR strpos(d, 'Beëindiging vanuit ZP') = 0 THEN RAISE EXCEPTION 'crm_beeindig niet aangepast'; END IF;
  EXECUTE d;

  -- Ondernemingswijziging beeindigt voortaan met code wijzigen_entiteit.
  d := pg_get_functiondef('public.crm_ondernemingswijziging'::regproc); o := d;
  d := replace(d, $a$coalesce(_einddatum, _ingangsdatum - 1), 'ondernemingswijziging',$a$, $a$coalesce(_einddatum, _ingangsdatum - 1), 'wijzigen_entiteit',$a$);
  IF d = o THEN RAISE EXCEPTION 'crm_ondernemingswijziging niet aangepast'; END IF;
  EXECUTE d;

  -- Contract meenemen herkent zowel de oude als de nieuwe code.
  d := pg_get_functiondef('public.contract_meenemen_kern'::regproc); o := d;
  d := replace(d, $a$a.details->>'reden' = 'ondernemingswijziging')$a$, $a$a.details->>'reden' IN ('ondernemingswijziging','wijzigen_entiteit'))$a$);
  IF d = o THEN RAISE EXCEPTION 'contract_meenemen_kern niet aangepast'; END IF;
  EXECUTE d;
END $mig$;

-- Vangnet bij elke nieuwe opzegging: beeindiging_zp alleen vanuit beheer door het team, anders altijd met toelichting.
CREATE OR REPLACE FUNCTION public.opzeg_reden_controle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := NEW.details->>'reden';
BEGIN
  IF NEW.type <> 'opzeggen' THEN RETURN NEW; END IF;
  IF r = 'beeindiging_zp' AND NOT (coalesce(NEW.details->>'bron','') = 'beheer_handmatig' AND coalesce(public.is_team_member(auth.uid()), false)) THEN
    RAISE EXCEPTION 'Deze opzegreden kan alleen het team kiezen.';
  END IF;
  IF r = 'anders' AND length(btrim(coalesce(NEW.details->>'toelichting',''))) < 3 THEN
    RAISE EXCEPTION 'Geef een toelichting van minimaal 3 tekens.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.opzeg_reden_controle() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS aa_opzeg_reden_controle ON public.klant_service_aanvragen;
CREATE TRIGGER aa_opzeg_reden_controle BEFORE INSERT ON public.klant_service_aanvragen
  FOR EACH ROW EXECUTE FUNCTION public.opzeg_reden_controle();

-- Scenario's
CREATE OR REPLACE FUNCTION public._ts_opzegreden(_naam text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a';
  klant_uid constant uuid := '7e570000-0000-4000-8000-00000000000c';
  adm constant uuid := '5d591f12-d010-4640-ae68-2b4f58953320';
  c jsonb := '[]'; k uuid; f text; res jsonb;
  ins constant text := $i$INSERT INTO public.klant_service_aanvragen (type, voornaam, achternaam, email, telefoon, polisnummer, details, is_test)
    VALUES ('opzeggen','Test','Opzeg','test+opzeg@zpzaken.nl','0612345678','ZPBAVTSOPZ', %L::jsonb, true)$i$;
BEGIN
  IF _naam = 'opzegreden_portaal_beeindiging_zp' THEN
    PERFORM set_config('request.jwt.claims', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
    f := public._ts_fout(format(ins, '{"reden":"beeindiging_zp","reden_label":"Beëindiging vanuit ZP","opzegdatum":"2030-01-01","bron":"mijn_zp"}'));
    c := c || public._ts_c('portaal (serverfunctie) geweigerd', 'Deze opzegreden kan alleen het team kiezen.', f);
    PERFORM public._ts_sessie(klant_uid, 'aal1');
    f := public._ts_fout(format(ins, '{"reden":"beeindiging_zp","opzegdatum":"2030-01-01","bron":"beheer_handmatig"}'));
    c := c || public._ts_c('klant met vervalste bron geweigerd', 'Deze opzegreden kan alleen het team kiezen.', f);
    PERFORM set_config('request.jwt.claims', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
    f := public._ts_fout(format(ins, '{"reden":"pensioen","reden_label":"Pensioen","opzegdatum":"2030-01-01","bron":"mijn_zp"}'));
    c := c || public._ts_c('portaal pensioen toegestaan', NULL, f);
  ELSIF _naam = 'opzegreden_portaal_anders_leeg' THEN
    f := public._ts_fout(format(ins, '{"reden":"anders","opzegdatum":"2030-01-01","bron":"mijn_zp"}'));
    c := c || public._ts_c('anders zonder toelichting geweigerd', 'Geef een toelichting van minimaal 3 tekens.', f);
    f := public._ts_fout(format(ins, '{"reden":"anders","toelichting":"  ab ","opzegdatum":"2030-01-01","bron":"mijn_zp"}'));
    c := c || public._ts_c('anders met 2 tekens geweigerd', 'Geef een toelichting van minimaal 3 tekens.', f);
    f := public._ts_fout(format(ins, '{"reden":"anders","toelichting":"Gaat naar het buitenland","opzegdatum":"2030-01-01","bron":"mijn_zp"}'));
    c := c || public._ts_c('anders met toelichting toegestaan', NULL, f);
  ELSIF _naam = 'opzegreden_beheer_beeindiging_zp' THEN
    k := public._ts_contract(ond_a, current_date - 60);
    PERFORM public._ts_sessie(adm, 'aal2');
    res := public.crm_beeindig(ond_a, ARRAY[k], ARRAY[]::uuid[], current_date, 'beeindiging_zp', 'Scenario beëindiging vanuit ZP', NULL);
    c := c || public._ts_c('contract heeft einddatum', current_date::text, (SELECT eind_datum::text FROM public.klant_contracten WHERE id = k))
         || public._ts_c('opzegregel met code', 'beeindiging_zp', (SELECT details->>'reden' FROM public.klant_service_aanvragen WHERE id = (res->>'aanvraag_id')::uuid))
         || public._ts_c('opzegregel met label', 'Beëindiging vanuit ZP', (SELECT details->>'reden_label' FROM public.klant_service_aanvragen WHERE id = (res->>'aanvraag_id')::uuid));
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_opzegreden(text) FROM PUBLIC, anon, authenticated;

DO $mig$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.test_scenario'::regproc); o := d;
  d := replace(d, $a$'bestaande_klant_dubbele_aanvraag'] || vitest;$a$,
    $a$'bestaande_klant_dubbele_aanvraag','opzegreden_portaal_beeindiging_zp','opzegreden_portaal_anders_leeg','opzegreden_beheer_beeindiging_zp'] || vitest;$a$);
  d := replace(d, $a$      c := c || public._ts_bestaande_klant();
    ELSE$a$, $a$      c := c || public._ts_bestaande_klant();
    ELSIF p_naam IN ('opzegreden_portaal_beeindiging_zp','opzegreden_portaal_anders_leeg','opzegreden_beheer_beeindiging_zp') THEN
      c := c || public._ts_opzegreden(p_naam);
    ELSE$a$);
  IF strpos(d, '_ts_opzegreden(p_naam)') = 0 OR strpos(d, '''opzegreden_beheer_beeindiging_zp''] || vitest') = 0 THEN RAISE EXCEPTION 'test_scenario niet aangepast'; END IF;
  EXECUTE d;
END $mig$;