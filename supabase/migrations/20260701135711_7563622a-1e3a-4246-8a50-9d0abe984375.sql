
CREATE TABLE public.crm_identiteit_beslissingen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  genormaliseerd_email TEXT NOT NULL UNIQUE,
  beslissing TEXT NOT NULL CHECK (beslissing IN ('akkoord','splitsen')),
  bekende_namen TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  beslist_door UUID REFERENCES auth.users(id),
  beslist_op TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_identiteit_beslissingen TO authenticated;
GRANT ALL ON public.crm_identiteit_beslissingen TO service_role;

ALTER TABLE public.crm_identiteit_beslissingen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teamleden kunnen beslissingen lezen"
  ON public.crm_identiteit_beslissingen
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Supervisor/admin kan beslissing toevoegen"
  ON public.crm_identiteit_beslissingen
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "Supervisor/admin kan beslissing wijzigen"
  ON public.crm_identiteit_beslissingen
  FOR UPDATE
  TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()))
  WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "Supervisor/admin kan beslissing verwijderen"
  ON public.crm_identiteit_beslissingen
  FOR DELETE
  TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TRIGGER update_crm_identiteit_beslissingen_updated_at
  BEFORE UPDATE ON public.crm_identiteit_beslissingen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
