ALTER TABLE public.ondernemingen ADD COLUMN IF NOT EXISTS samengevoegd_naar uuid REFERENCES public.ondernemingen(id);
ALTER TABLE public.ondernemingen ADD COLUMN IF NOT EXISTS samengevoegd_op timestamptz;
COMMENT ON COLUMN public.ondernemingen.samengevoegd_naar IS 'Dubbele klantkaart samengevoegd naar deze kaart; nooit verwijderen, verborgen in overzichten en zoeken.';
DO $m$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.zoek_universeel(text,boolean)'::regprocedure);
  d := replace(d, 'WHERE z.id IS NOT NULL AND (_met_test OR NOT o.is_test)', 'WHERE z.id IS NOT NULL AND (_met_test OR NOT o.is_test) AND o.samengevoegd_naar IS NULL');
  IF position('samengevoegd_naar' in d) = 0 THEN RAISE EXCEPTION 'zoek_universeel niet aangepast'; END IF;
  EXECUTE d;
  d := pg_get_functiondef('public.zoek_koppel_kandidaten(uuid,text)'::regprocedure);
  d := replace(d, 'WHERE s.id IS NOT NULL AND (met_test OR NOT o.is_test)', 'WHERE s.id IS NOT NULL AND (met_test OR NOT o.is_test) AND o.samengevoegd_naar IS NULL');
  IF position('samengevoegd_naar' in d) = 0 THEN RAISE EXCEPTION 'zoek_koppel_kandidaten niet aangepast'; END IF;
  EXECUTE d;
END $m$;