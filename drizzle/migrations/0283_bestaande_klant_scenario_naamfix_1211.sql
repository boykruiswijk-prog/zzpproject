-- Herstel naamconflict tussen de scenariovariabele en de kolom lead_id.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public._ts_bestaande_klant()'::regprocedure);
  d := replace(d, 'lead_id constant uuid', 'v_lead constant uuid');
  d := replace(d, '(lead_id', '(v_lead');
  d := replace(d, '= lead_id', '= v_lead');
  d := replace(d, 'lead_id::text', 'v_lead::text');
  IF position('v_lead constant uuid' IN d) = 0 OR position('lead_id = lead_id' IN d) > 0 THEN
    RAISE EXCEPTION '_ts_bestaande_klant naamfix niet gelukt';
  END IF;
  EXECUTE d;
END $do$;
REVOKE ALL ON FUNCTION public._ts_bestaande_klant() FROM PUBLIC, anon, authenticated;
