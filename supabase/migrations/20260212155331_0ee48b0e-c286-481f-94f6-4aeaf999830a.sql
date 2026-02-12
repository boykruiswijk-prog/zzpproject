
-- Table for collective pilot signups
CREATE TABLE public.collective_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_slug TEXT NOT NULL,
  naam TEXT NOT NULL,
  email TEXT NOT NULL,
  telefoon TEXT,
  postcode TEXT,
  type TEXT, -- 'prive' or 'zakelijk' for energy pilot
  huidige_leverancier TEXT,
  interesse_gebieden TEXT[], -- for software pilot: checkboxes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for future collective newsletter signups
CREATE TABLE public.collective_newsletter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collective_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_newsletter ENABLE ROW LEVEL SECURITY;

-- Public insert policies (anyone can sign up)
CREATE POLICY "Anyone can sign up for a pilot"
  ON public.collective_signups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.collective_newsletter FOR INSERT
  WITH CHECK (true);

-- Only authenticated team members can read
CREATE POLICY "Team members can view signups"
  ON public.collective_signups FOR SELECT
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can view newsletter"
  ON public.collective_newsletter FOR SELECT
  USING (public.is_team_member(auth.uid()));

-- Count function for progress bars (public, returns only count)
CREATE OR REPLACE FUNCTION public.get_pilot_signup_count(pilot TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.collective_signups WHERE pilot_slug = pilot;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
