
-- Polis-lifecycle: pauze, opzegging, heractivering
-- Stap 1: kolommen + audit-tabel

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pauze_start_datum date,
  ADD COLUMN IF NOT EXISTS pauze_reden text,
  ADD COLUMN IF NOT EXISTS pauze_door uuid,
  ADD COLUMN IF NOT EXISTS pauze_reminder_verzonden_op timestamptz,
  ADD COLUMN IF NOT EXISTS opzeg_datum date,
  ADD COLUMN IF NOT EXISTS opzeg_reden text,
  ADD COLUMN IF NOT EXISTS opzeg_toelichting text,
  ADD COLUMN IF NOT EXISTS opzeg_door uuid,
  ADD COLUMN IF NOT EXISTS heractivering_datum date,
  ADD COLUMN IF NOT EXISTS heractivering_door uuid,
  ADD COLUMN IF NOT EXISTS functie_bij_aanvraag text,
  ADD COLUMN IF NOT EXISTS functie_bij_heractivering text,
  ADD COLUMN IF NOT EXISTS exact_creditnota_id text,
  ADD COLUMN IF NOT EXISTS exact_creditnota_amount numeric,
  ADD COLUMN IF NOT EXISTS exact_creditnota_created_at timestamptz;

-- Backfill functie_bij_aanvraag uit beroep / extra_data
UPDATE public.leads
   SET functie_bij_aanvraag = COALESCE(NULLIF(beroep, ''), NULLIF(extra_data->>'functie', ''))
 WHERE functie_bij_aanvraag IS NULL
   AND type = 'verzekering_aanvraag';

-- Audit-tabel
CREATE TABLE IF NOT EXISTS public.polis_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  actie text NOT NULL, -- 'pauzeren' | 'hervatten' | 'opzeggen' | 'heractiveren' | 'reminder_verzonden' | 'creditnota_aangemaakt'
  uitgevoerd_door uuid, -- auth.uid() of NULL voor system/cron
  rol text, -- 'klant' | 'admin' | 'system'
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  exact_response jsonb,
  succes boolean NOT NULL DEFAULT true,
  fout_melding text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polis_audit_log_lead_id ON public.polis_audit_log(lead_id, created_at DESC);

GRANT SELECT ON public.polis_audit_log TO authenticated;
GRANT ALL ON public.polis_audit_log TO service_role;

ALTER TABLE public.polis_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT (heeft team-rol)
CREATE POLICY "Admins kunnen audit log inzien"
  ON public.polis_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));
-- INSERT alleen via service_role (Edge Functions), geen policy nodig voor authenticated
