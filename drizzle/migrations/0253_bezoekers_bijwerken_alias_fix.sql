CREATE OR REPLACE FUNCTION public.bezoekers_bijwerken(p_dag date, p_rijen jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; r jsonb;
BEGIN
  IF NOT public.robot_toegang(ARRAY[]::app_role[]) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  IF p_dag IS NULL THEN RAISE EXCEPTION 'dag ontbreekt'; END IF;
  IF p_rijen IS NULL OR jsonb_typeof(p_rijen) <> 'array' THEN RAISE EXCEPTION 'rijen moet een lijst zijn'; END IF;
  IF jsonb_array_length(p_rijen) > 500 THEN RAISE EXCEPTION 'maximaal 500 rijen'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rijen) LOOP
    IF jsonb_typeof(r) <> 'object' THEN RAISE EXCEPTION 'rij moet een object zijn'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('plaats','provincie','aantal')) THEN RAISE EXCEPTION 'alleen plaats, provincie en aantal toegestaan'; END IF;
    IF NOT (r ? 'aantal') OR jsonb_typeof(r->'aantal') <> 'number' OR (r->>'aantal')::numeric < 0
       OR (r->>'aantal')::numeric <> trunc((r->>'aantal')::numeric) OR (r->>'aantal')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'aantal moet een geheel getal >= 0 zijn'; END IF;
    IF (r ? 'plaats' AND jsonb_typeof(r->'plaats') NOT IN ('string','null')) OR (r ? 'provincie' AND jsonb_typeof(r->'provincie') NOT IN ('string','null')) THEN
      RAISE EXCEPTION 'plaats en provincie moeten tekst zijn'; END IF;
  END LOOP;
  DELETE FROM public.scherm_bezoekers WHERE dag = p_dag AND soort IN ('dag','totaal');
  INSERT INTO public.scherm_bezoekers (dag, soort, plaats, provincie, aantal)
  SELECT p_dag, 'dag', public.bezoekers_ga4_naam('plaats', e->>'plaats'), public.bezoekers_ga4_naam('provincie', e->>'provincie'), (e->>'aantal')::int
  FROM jsonb_array_elements(p_rijen) AS x(e);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bezoekers_bijwerken(date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bezoekers_bijwerken(date, jsonb) TO service_role;