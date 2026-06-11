CREATE TABLE public.lead_notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_type TEXT NOT NULL,
  lead_id UUID,
  recipient TEXT NOT NULL,
  cc TEXT,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'queued')),
  error_message TEXT,
  resend_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_notification_log TO authenticated;
GRANT ALL ON public.lead_notification_log TO service_role;

ALTER TABLE public.lead_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification log"
  ON public.lead_notification_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_lead_notification_log_lead ON public.lead_notification_log(lead_type, lead_id);
CREATE INDEX idx_lead_notification_log_created ON public.lead_notification_log(created_at DESC);
