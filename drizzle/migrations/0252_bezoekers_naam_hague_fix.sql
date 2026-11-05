CREATE OR REPLACE FUNCTION public.bezoekers_ga4_naam(_soort text, _naam text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN nullif(btrim(coalesce(_naam, '')), '') IS NULL OR btrim(_naam) IN ('(not set)', '(other)') THEN 'onbekend'
    WHEN _soort = 'provincie' THEN coalesce((jsonb_build_object(
      'north holland','Noord-Holland','south holland','Zuid-Holland','north brabant','Noord-Brabant',
      'friesland','Fryslân','fryslan','Fryslân','fryslân','Fryslân','groningen','Groningen','drenthe','Drenthe',
      'overijssel','Overijssel','flevoland','Flevoland','gelderland','Gelderland','utrecht','Utrecht',
      'zeeland','Zeeland','limburg','Limburg','noord-holland','Noord-Holland','zuid-holland','Zuid-Holland',
      'noord-brabant','Noord-Brabant') ->> lower(btrim(_naam))), 'onbekend')
    ELSE coalesce((jsonb_build_object(
      'the hague','Den Haag','hague','Den Haag','den bosch','''s-Hertogenbosch','s-hertogenbosch','''s-Hertogenbosch',
      'flushing','Vlissingen','nimwegen','Nijmegen','leyden','Leiden','bois-le-duc','''s-Hertogenbosch')
      ->> lower(btrim(_naam))), left(regexp_replace(btrim(_naam), '[^[:alnum:]'' .()-]', '', 'g'), 60))
  END;
$$;
REVOKE ALL ON FUNCTION public.bezoekers_ga4_naam(text, text) FROM PUBLIC, anon, authenticated;