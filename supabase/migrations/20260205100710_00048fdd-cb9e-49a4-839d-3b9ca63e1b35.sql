-- Create articles table for kennisbank
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  category TEXT NOT NULL DEFAULT 'Algemeen',
  source_url TEXT,
  source_name TEXT,
  image_url TEXT,
  read_time TEXT DEFAULT '5 min',
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_published BOOLEAN DEFAULT true,
  seo_title TEXT,
  seo_description TEXT
);

-- Enable RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Public read access for articles (since this is a public website)
CREATE POLICY "Articles are publicly readable"
  ON public.articles
  FOR SELECT
  USING (is_published = true);

-- Admin insert/update/delete (using existing is_team_member function)
CREATE POLICY "Team members can manage articles"
  ON public.articles
  FOR ALL
  USING (public.is_team_member(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_articles_category ON public.articles(category);
CREATE INDEX idx_articles_published_at ON public.articles(published_at DESC);