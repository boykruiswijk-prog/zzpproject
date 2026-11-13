CREATE OR REPLACE FUNCTION public._ts_telling_admin_tv()
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE s jsonb; n jsonb; t jsonb; c jsonb := '[]';
BEGIN
  s := public.scherm_groei(); n := public.tel_netto_groei(date '2026-10-01', false);
  c := c || public._ts_c('tv klanten = tel_klanten', public.tel_klanten(false)::text, s->>'klanten')
         || public._ts_c('tv contracten = tel_contracten', public.tel_contracten(false)::text, s->>'contracten')
         || public._ts_c('tv productsplitsing = contracten', s->>'contracten', ((s->>'bav_avb')::int+(s->>'cyber')::int+(s->>'lidmaatschap')::int+(s->>'overig')::int)::text)
         || public._ts_c('tv sinds = admin netto groei', n->'klanten'->>'begin' || '+' || (n->'klanten'->>'instroom') || '-' || (n->'klanten'->>'uitstroom'),
                         (s->'sinds'->>'begin') || '+' || (s->'sinds'->>'nieuw') || '-' || (s->'sinds'->>'gestopt'))
         || public._ts_c('netto groei sluit op tel_klanten', public.tel_klanten(false)::text,
                         ((n->'cumulatief'->>'actief_begin')::int + (n->'cumulatief'->>'netto_groei')::int)::text)
         || public._ts_c('week sluit op tel_klanten', public.tel_klanten(false)::text,
                         ((s->'week'->>'begin')::int + (s->'week'->>'nieuw')::int - (s->'week'->>'gestopt')::int)::text);
  -- Met een nieuw testcontract (alleen zichtbaar met toon_test) blijft de telling sluiten en telt de klant als instroom.
  PERFORM public._ts_contract('7e570000-0000-4000-8000-00000000000a', ((now() AT TIME ZONE 'Europe/Amsterdam')::date + 20));
  t := public.tel_klanten_stand(date '2026-10-01', true);
  c := c || public._ts_c('met testdata sluitend', public.tel_klanten(true)::text, ((t->>'begin')::int + (t->>'netto')::int)::text)
         || public._ts_c('zonder testdata ongewijzigd', s->>'klanten', public.tel_klanten(false)::text);
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_telling_admin_tv() FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE d text := pg_get_functiondef('public.test_scenario(text)'::regprocedure);
BEGIN
  d := replace(d, $a$'polis_lifecycle_klant_beeindiging_zp'] || vitest$a$, $a$'polis_lifecycle_klant_beeindiging_zp','telling_admin_tv_gelijk'] || vitest$a$);
  d := replace(d, $a$      c := c || public._ts_polis_lifecycle_opzeg();
    ELSE$a$, $a$      c := c || public._ts_polis_lifecycle_opzeg();
    ELSIF p_naam = 'telling_admin_tv_gelijk' THEN
      c := c || public._ts_telling_admin_tv();
    ELSE$a$);
  IF d NOT LIKE '%_ts_telling_admin_tv%' OR d NOT LIKE '%''telling_admin_tv_gelijk''] || vitest%' THEN RAISE EXCEPTION 'test_scenario vervanging mislukt'; END IF;
  EXECUTE d;
END $do$;