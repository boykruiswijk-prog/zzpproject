-- Klant service aanvragen (Mijn ZP wizards)
CREATE TABLE public.klant_service_aanvragen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('certificaat','pauzeren','documenten')),
  voornaam TEXT NOT NULL,
  achternaam TEXT NOT NULL,
  email TEXT NOT NULL,
  telefoon TEXT NOT NULL,
  polisnummer TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'nieuw',
  behandeld_door UUID,
  behandeld_op TIMESTAMPTZ,
  notities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.klant_service_aanvragen TO authenticated;
GRANT ALL ON public.klant_service_aanvragen TO service_role;

ALTER TABLE public.klant_service_aanvragen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins kunnen alles op klant_service_aanvragen"
  ON public.klant_service_aanvragen FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team kan lezen klant_service_aanvragen"
  ON public.klant_service_aanvragen FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE TRIGGER trg_klant_service_aanvragen_updated
  BEFORE UPDATE ON public.klant_service_aanvragen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Social media features (Deel 10 - Optie C)
CREATE TABLE public.social_media_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('linkedin','instagram')),
  post_url TEXT NOT NULL,
  preview_image_url TEXT,
  preview_text TEXT,
  published_at TIMESTAMPTZ,
  featured_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_media_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_features TO authenticated;
GRANT ALL ON public.social_media_features TO service_role;

ALTER TABLE public.social_media_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Iedereen mag actieve social posts lezen"
  ON public.social_media_features FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE POLICY "Admins beheren social posts"
  ON public.social_media_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_social_media_features_updated
  BEFORE UPDATE ON public.social_media_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();