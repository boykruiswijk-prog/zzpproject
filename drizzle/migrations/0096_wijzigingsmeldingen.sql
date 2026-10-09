ALTER TABLE public.interne_melding_ontvangers DROP CONSTRAINT IF EXISTS interne_melding_ontvangers_soort_check;
ALTER TABLE public.interne_melding_ontvangers ADD CONSTRAINT interne_melding_ontvangers_soort_check CHECK (soort IN ('algemeen','exact_boeking','bav_override','afas_factuur','wijziging_site_admin'));

CREATE TABLE public.wijzigingsmeldingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  titel text NOT NULL CHECK (length(trim(titel)) > 0),
  omschrijving text NOT NULL CHECK (length(trim(omschrijving)) > 0),
  onderdeel text NOT NULL CHECK (onderdeel IN ('website','admin','beide')),
  wat_moet_ellen_doen text,
  gemaild_op timestamptz,
  mail_log_id uuid
);
GRANT SELECT, INSERT ON public.wijzigingsmeldingen TO authenticated;
GRANT ALL ON public.wijzigingsmeldingen TO service_role;
ALTER TABLE public.wijzigingsmeldingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest wijzigingsmeldingen" ON public.wijzigingsmeldingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor of admin voegt wijzigingsmelding toe" ON public.wijzigingsmeldingen FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()) AND gemaild_op IS NULL AND mail_log_id IS NULL);
CREATE INDEX wijzigingsmeldingen_ongemaild_idx ON public.wijzigingsmeldingen (created_at) WHERE gemaild_op IS NULL;