DO $m$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.zoek_universeel(text,boolean)'::regprocedure);
  d := replace(d, ') = ANY(init)', ') = init[1]');
  d := replace(d, 'init := ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(nq, '' '') w WHERE length(w) = 1);',
                  'init := ARRAY(SELECT w FROM regexp_split_to_table(nq, '' '') WITH ORDINALITY t(w, n) WHERE length(w) = 1 ORDER BY n);');
  d := replace(d, 'SELECT 1 FROM unnest(init) i WHERE lower(o.afas_contactpersoon) ~ (''\m'' || i)', 'SELECT 1 WHERE init[1] IS NOT NULL AND lower(o.afas_contactpersoon) ~ (''\m'' || init[1])');
  d := replace(d, '''titel'', btrim(concat_ws('' '', a.voornaam, a.achternaam)) || coalesce('' · '' || nullif(a.details->>''bedrijfsnaam'', ''''), ''''),',
                  '''titel'', concat_ws('' · '', nullif(btrim(concat_ws('' '', a.voornaam, a.achternaam)), ''''), nullif(a.details->>''bedrijfsnaam'', ''''), CASE WHEN coalesce(btrim(concat_ws('' '', a.voornaam, a.achternaam)), '''') = '''' AND coalesce(a.details->>''bedrijfsnaam'', '''') = '''' THEN a.email END),');
  IF position('init[1]' in d) = 0 OR position('WITH ORDINALITY t(w, n)' in d) = 0 OR position('THEN a.email END' in d) = 0 THEN RAISE EXCEPTION 'zoek_universeel niet aangepast'; END IF;
  EXECUTE d;
END $m$;