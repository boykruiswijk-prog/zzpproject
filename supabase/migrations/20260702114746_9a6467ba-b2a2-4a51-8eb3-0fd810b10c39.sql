
CREATE TABLE public.activiteiten_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actie_type text NOT NULL,
  omschrijving text NOT NULL,
  uitgevoerd_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uitgevoerd_door_naam text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  klant_email text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activiteiten_log_aangemaakt_op ON public.activiteiten_log (aangemaakt_op DESC);
CREATE INDEX idx_activiteiten_log_actie_type ON public.activiteiten_log (actie_type);
CREATE INDEX idx_activiteiten_log_uitgevoerd_door ON public.activiteiten_log (uitgevoerd_door);
CREATE INDEX idx_activiteiten_log_lead_id ON public.activiteiten_log (lead_id);

GRANT SELECT, INSERT ON public.activiteiten_log TO authenticated;
GRANT ALL ON public.activiteiten_log TO service_role;

ALTER TABLE public.activiteiten_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teamleden zien alle activiteiten"
  ON public.activiteiten_log
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Teamleden loggen eigen handeling"
  ON public.activiteiten_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_member(auth.uid())
    AND uitgevoerd_door = auth.uid()
  );
-- Bewust geen UPDATE of DELETE policies: log is onveranderlijk.
