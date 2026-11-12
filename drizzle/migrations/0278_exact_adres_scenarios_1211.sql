CREATE OR REPLACE FUNCTION public._ts_exact_adres(p_naam text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a'; c jsonb := '[]';
BEGIN
  IF p_naam = 'exact_adres_test_nooit' THEN
    UPDATE ondernemingen SET exact_account_id = '7e570000-0000-4000-8000-0000000000ea', straat = 'Teststraat', huisnummer = '1', postcode = '9999 ZZ', plaats = 'Testdorp' WHERE id = ond_a;
    c := c || public._ts_c('testonderneming komt nooit in de Exact-wachtrij', '0', (SELECT count(*)::text FROM exact_adres_sync WHERE onderneming_id = ond_a));
  ELSIF p_naam = 'exact_adres_wachtrij' THEN
    -- Alleen binnen deze teruggedraaide transactie als niet-test behandelen.
    UPDATE ondernemingen SET is_test = false, exact_account_id = '7e570000-0000-4000-8000-0000000000ea' WHERE id = ond_a;
    UPDATE ondernemingen SET naam = naam WHERE id = ond_a;
    c := c || public._ts_c('geen adreswijziging: geen wachtrij', '0', (SELECT count(*)::text FROM exact_adres_sync WHERE onderneming_id = ond_a));
    UPDATE ondernemingen SET straat = 'Scenariostraat', huisnummer = '2', postcode = '9999 ZZ', plaats = 'Testdorp' WHERE id = ond_a;
    UPDATE ondernemingen SET huisnummer = '3' WHERE id = ond_a;
    c := c || public._ts_c('adreswijziging: precies één open rij', '1', (SELECT count(*)::text FROM exact_adres_sync WHERE onderneming_id = ond_a AND status = 'wacht'));
    UPDATE exact_adres_sync SET status = 'fout' WHERE onderneming_id = ond_a;
    UPDATE ondernemingen SET huisnummer = '4' WHERE id = ond_a;
    c := c || public._ts_c('fout blijft open en wordt opnieuw geprobeerd', 'wacht', (SELECT string_agg(status, ',') FROM exact_adres_sync WHERE onderneming_id = ond_a));
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_exact_adres(text) FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.test_scenario(text)'::regprocedure);
  IF position('_ts_exact_adres' IN d) = 0 THEN
    d := replace(d, $r$'certificaat_nieuwe_klant'] || vitest$r$, $r$'certificaat_nieuwe_klant','exact_adres_test_nooit','exact_adres_wachtrij'] || vitest$r$);
    d := replace(d, $r$    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$, $r$    ELSIF p_naam IN ('exact_adres_test_nooit','exact_adres_wachtrij') THEN
      c := c || public._ts_exact_adres(p_naam);
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$);
    IF position('_ts_exact_adres' IN d) = 0 OR position('exact_adres_wachtrij''] || vitest' IN d) = 0 THEN
      RAISE EXCEPTION 'test_scenario kon niet worden uitgebreid';
    END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef('public._ts_tel()'::regprocedure);
  IF position('exact_adres_sync' IN d) = 0 THEN
    d := replace(d, $r$ARRAY['klant_contracten',$r$, $r$ARRAY['exact_adres_sync','klant_contracten',$r$);
    IF position('exact_adres_sync' IN d) = 0 THEN RAISE EXCEPTION '_ts_tel kon niet worden uitgebreid'; END IF;
    EXECUTE d;
  END IF;
END $do$;
REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_tel() FROM PUBLIC, anon, authenticated;