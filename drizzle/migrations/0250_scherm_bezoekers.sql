-- A8-aanvulling Bezoekerskaart: GA4-cache op plaatsniveau (alleen plaats, provincie, aantal). Geen IP, geen personen.
CREATE TABLE public.scherm_bezoekers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dag date NOT NULL,
  soort text NOT NULL CHECK (soort IN ('dag','nu','totaal')),
  plaats text NOT NULL,
  provincie text NOT NULL,
  aantal integer NOT NULL DEFAULT 0 CHECK (aantal >= 0),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scherm_bezoekers_dag ON public.scherm_bezoekers (dag, soort);
GRANT ALL ON public.scherm_bezoekers TO service_role;
ALTER TABLE public.scherm_bezoekers ENABLE ROW LEVEL SECURITY;
-- Geen policies: alleen service_role (bezoekers-ga4 en scherm-data).

CREATE OR REPLACE FUNCTION public.scherm_bezoekers_vervangen(_dag date, _rijen jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(_rijen) <> 'array' OR jsonb_array_length(_rijen) > 500 THEN RAISE EXCEPTION 'ongeldige rijen'; END IF;
  DELETE FROM public.scherm_bezoekers WHERE dag = _dag OR dag < _dag - 2;
  INSERT INTO public.scherm_bezoekers (dag, soort, plaats, provincie, aantal)
  SELECT _dag, r->>'soort', left(r->>'plaats', 60), left(r->>'provincie', 60), greatest(0, (r->>'aantal')::int)
  FROM jsonb_array_elements(_rijen) r;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.scherm_bezoekers_vervangen(date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_bezoekers_vervangen(date, jsonb) TO service_role;