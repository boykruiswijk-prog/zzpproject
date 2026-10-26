DO $fix$
DECLARE d text;
BEGIN
SELECT pg_get_functiondef('public.zoek_universeel(text,boolean)'::regprocedure) INTO d;
d:=replace(d,'coalesce(klant_nummers,ARRAY[]::text[])||ARRAY[kvk,kvk_nummer,exact_relatie_code,postcode]','CASE WHEN bron=''klant_contracten'' THEN ARRAY[]::text[] ELSE coalesce(klant_nummers,ARRAY[]::text[]) END||ARRAY[kvk,kvk_nummer,exact_relatie_code,postcode]');
EXECUTE d;
END $fix$;