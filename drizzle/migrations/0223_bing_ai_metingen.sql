CREATE TABLE public.bing_ai_metingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datum date NOT NULL UNIQUE,
  periode text NOT NULL,
  citaties integer NOT NULL CHECK (citaties >= 0),
  gem_geciteerde_paginas numeric CHECK (gem_geciteerde_paginas IS NULL OR gem_geciteerde_paginas >= 0),
  citaties_7d integer CHECK (citaties_7d IS NULL OR citaties_7d >= 0),
  onderwerpen text[],
  bron text NOT NULL DEFAULT 'bing_webmaster',
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bing_ai_metingen TO authenticated;
GRANT ALL ON public.bing_ai_metingen TO service_role;
ALTER TABLE public.bing_ai_metingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen Bing AI-metingen" ON public.bing_ai_metingen FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.bing_ai_bijwerken(p_datum date, p_periode text, p_citaties int, p_gem_paginas numeric, p_citaties_7d int, p_onderwerpen text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_o text;
BEGIN
  IF p_datum IS NULL OR p_datum > (now() AT TIME ZONE 'Europe/Amsterdam')::date + 1 THEN RAISE EXCEPTION 'ongeldige datum'; END IF;
  IF p_periode IS NULL OR btrim(p_periode) = '' OR length(p_periode) > 20 THEN RAISE EXCEPTION 'ongeldige periode'; END IF;
  IF p_citaties IS NULL OR p_citaties < 0 THEN RAISE EXCEPTION 'citaties moet 0 of meer zijn'; END IF;
  IF p_gem_paginas IS NOT NULL AND p_gem_paginas < 0 THEN RAISE EXCEPTION 'gemiddeld aantal paginas moet 0 of meer zijn'; END IF;
  IF p_citaties_7d IS NOT NULL AND p_citaties_7d < 0 THEN RAISE EXCEPTION 'citaties_7d moet 0 of meer zijn'; END IF;
  IF p_onderwerpen IS NOT NULL THEN
    IF coalesce(array_length(p_onderwerpen, 1), 0) > 10 THEN RAISE EXCEPTION 'maximaal 10 onderwerpen'; END IF;
    FOREACH v_o IN ARRAY p_onderwerpen LOOP
      IF v_o IS NULL OR length(v_o) > 200 THEN RAISE EXCEPTION 'onderwerp maximaal 200 tekens'; END IF;
    END LOOP;
  END IF;
  INSERT INTO public.bing_ai_metingen (datum, periode, citaties, gem_geciteerde_paginas, citaties_7d, onderwerpen)
  VALUES (p_datum, btrim(p_periode), p_citaties, p_gem_paginas, p_citaties_7d, p_onderwerpen)
  ON CONFLICT (datum) DO UPDATE SET periode = EXCLUDED.periode, citaties = EXCLUDED.citaties,
    gem_geciteerde_paginas = EXCLUDED.gem_geciteerde_paginas, citaties_7d = EXCLUDED.citaties_7d, onderwerpen = EXCLUDED.onderwerpen
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.bing_ai_bijwerken(date, text, int, numeric, int, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bing_ai_bijwerken(date, text, int, numeric, int, text[]) TO service_role;