CREATE TABLE public.aov_doorverwijzingen (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 klik_id uuid NOT NULL UNIQUE,
 bron text NOT NULL CHECK (char_length(bron) BETWEEN 1 AND 800),
 doel text NOT NULL CHECK (doel IN ('rekentool','advies')),
 user_id uuid NULL,
 klant_ref text NULL CHECK (klant_ref IS NULL OR char_length(klant_ref) <= 100)
);
GRANT INSERT ON public.aov_doorverwijzingen TO anon, authenticated;
GRANT SELECT ON public.aov_doorverwijzingen TO authenticated;
GRANT ALL ON public.aov_doorverwijzingen TO service_role;
ALTER TABLE public.aov_doorverwijzingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AOV klik toevoegen" ON public.aov_doorverwijzingen FOR INSERT TO anon, authenticated WITH CHECK ((user_id IS NULL OR user_id = (SELECT auth.uid())) AND (user_id IS NOT NULL OR klant_ref IS NULL));
CREATE POLICY "AOV admin lezen" ON public.aov_doorverwijzingen FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX aov_doorverwijzingen_created_at_idx ON public.aov_doorverwijzingen (created_at DESC);
CREATE FUNCTION public.aov_doorverwijzingen_overzicht() RETURNS TABLE(id uuid,created_at timestamptz,klik_id uuid,bron text,doel text,user_id uuid,klant_ref text,klant_naam text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,a.created_at,a.klik_id,a.bron,a.doel,a.user_id,a.klant_ref,p.full_name FROM public.aov_doorverwijzingen a LEFT JOIN public.profiles p ON p.id=a.user_id WHERE public.has_role(auth.uid(),'admin') ORDER BY a.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.aov_doorverwijzingen_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aov_doorverwijzingen_overzicht() TO authenticated, service_role;