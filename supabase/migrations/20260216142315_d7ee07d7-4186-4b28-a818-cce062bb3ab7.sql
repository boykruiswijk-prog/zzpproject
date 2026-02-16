
CREATE TABLE public.collective_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  naam TEXT,
  email TEXT,
  suggestie TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nieuw'
);

ALTER TABLE public.collective_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a suggestion"
ON public.collective_suggestions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Team members can view suggestions"
ON public.collective_suggestions
FOR SELECT
USING (is_team_member(auth.uid()));

CREATE POLICY "Team members can update suggestions"
ON public.collective_suggestions
FOR UPDATE
USING (is_team_member(auth.uid()));
