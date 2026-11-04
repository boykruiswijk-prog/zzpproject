-- Array-uitbreiding met tekstliteral expliciet als text (anders leest PostgreSQL de literal als array).
DO $do$
DECLARE d text; r text[];
BEGIN
  SELECT pg_get_functiondef('public.contract_meenemen_kern(uuid,uuid,text,text)'::regprocedure) INTO d;
  d := replace(d, '''Exact-relatie aanmaken via de relatieroute (eigen relatiecode, nooit die van de voorganger)'';', '''Exact-relatie aanmaken via de relatieroute (eigen relatiecode, nooit die van de voorganger)''::text;');
  d := replace(d, '''incassomachtiging van de BV opvragen'';', '''incassomachtiging van de BV opvragen''::text;');
  EXECUTE d;
  SELECT pg_get_functiondef('public.mijn_gegevens_aanvullen(text,jsonb)'::regprocedure) INTO d;
  FOREACH r SLICE 1 IN ARRAY ARRAY[['v_alle || ''telefoonnummer'';','v_alle || ''telefoonnummer''::text;'],
      ['v_velden || ''straat'';','v_velden || ''straat''::text;'],['v_velden || ''huisnummer'';','v_velden || ''huisnummer''::text;'],
      ['v_velden || ''postcode'';','v_velden || ''postcode''::text;'],['v_velden || ''plaats'';','v_velden || ''plaats''::text;']] LOOP
    IF position(r[1] in d) = 0 THEN RAISE EXCEPTION 'niet gevonden: %', r[1]; END IF;
    d := replace(d, r[1], r[2]);
  END LOOP;
  EXECUTE d;
END $do$;
