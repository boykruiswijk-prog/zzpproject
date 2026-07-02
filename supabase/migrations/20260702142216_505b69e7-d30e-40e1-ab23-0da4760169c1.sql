-- Redactie-omgeving Kennisbank: auteurs + data-driven rubrieken

-- 1. Voeg auteur-velden toe aan articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_name text;

-- 2. Rubrieken-tabel (data-driven hubmapping)
CREATE TABLE IF NOT EXISTS public.article_categories (
  slug text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  hub_slug text,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.article_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_categories TO authenticated;
GRANT ALL ON public.article_categories TO service_role;

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
  ON public.article_categories FOR SELECT
  USING (true);

CREATE POLICY "Team members can manage categories"
  ON public.article_categories FOR ALL
  TO authenticated
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));

CREATE TRIGGER update_article_categories_updated_at
  BEFORE UPDATE ON public.article_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed met bestaande labels + koppel aan huidige website-hubs
INSERT INTO public.article_categories (slug, label, hub_slug, sort_order) VALUES
  ('wetgeving',      'Wetgeving',      'wet-en-regelgeving', 10),
  ('regelgeving',    'Regelgeving',    'wet-en-regelgeving', 20),
  ('nieuws',         'Nieuws',         'ondernemen',         30),
  ('verzekeringen',  'Verzekeringen',  'ondernemen',         40),
  ('fiscaal',        'Fiscaal',        'belastingen',        50),
  ('financien',      'Financiën',      'financien',          60)
ON CONFLICT (slug) DO NOTHING;
