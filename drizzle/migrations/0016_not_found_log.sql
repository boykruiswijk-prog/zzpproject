CREATE TABLE public.not_found_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pad text NOT NULL UNIQUE,
  laatste_referrer text,
  laatste_user_agent text,
  aantal integer NOT NULL DEFAULT 1,
  eerste_op timestamptz NOT NULL DEFAULT now(),
  laatste_op timestamptz NOT NULL DEFAULT now(),
  afgehandeld boolean NOT NULL DEFAULT false
);
GRANT SELECT, UPDATE ON public.not_found_log TO authenticated;
GRANT ALL ON public.not_found_log TO service_role;
ALTER TABLE public.not_found_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest niet-gevonden pagina's" ON public.not_found_log
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team markeert niet-gevonden pagina's" ON public.not_found_log
  FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

-- Enige schrijfroute voor bezoekers: telt per pad op, met harde grenzen.
CREATE OR REPLACE FUNCTION public.log_not_found(_pad text, _referrer text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_pad text;
BEGIN
  v_pad := left(lower(split_part(coalesce(_pad, ''), '?', 1)), 300);
  IF v_pad = '' OR left(v_pad, 1) <> '/' OR v_pad LIKE '/admin%' OR v_pad LIKE '/portal%' THEN
    RETURN;
  END IF;
  -- Bestaand pad: alleen teller ophogen (max 1x per 10 sec per pad).
  UPDATE public.not_found_log
     SET aantal = aantal + 1, laatste_op = now(),
         laatste_referrer = left(_referrer, 300), laatste_user_agent = left(_user_agent, 300)
   WHERE pad = v_pad AND laatste_op < now() - interval '10 seconds';
  IF FOUND OR EXISTS (SELECT 1 FROM public.not_found_log WHERE pad = v_pad) THEN
    RETURN;
  END IF;
  -- Nieuwe paden: maximaal 200 per uur, tegen volspammen.
  IF (SELECT count(*) FROM public.not_found_log WHERE eerste_op > now() - interval '1 hour') >= 200 THEN
    RETURN;
  END IF;
  INSERT INTO public.not_found_log (pad, laatste_referrer, laatste_user_agent)
  VALUES (v_pad, left(_referrer, 300), left(_user_agent, 300))
  ON CONFLICT (pad) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.log_not_found(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_not_found(text, text, text) TO anon, authenticated;