
CREATE TABLE IF NOT EXISTS public.monthly_invoices_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  factuur_jaar INTEGER NOT NULL,
  factuur_maand INTEGER NOT NULL,
  periode_start DATE NOT NULL,
  periode_eind DATE NOT NULL,
  polis_einddatum DATE,
  bedrag NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  exact_invoice_id TEXT,
  exact_invoice_number TEXT,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, factuur_jaar, factuur_maand)
);

GRANT SELECT ON public.monthly_invoices_log TO authenticated;
GRANT ALL ON public.monthly_invoices_log TO service_role;

ALTER TABLE public.monthly_invoices_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins kunnen monthly_invoices_log lezen"
  ON public.monthly_invoices_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_monthly_invoices_log_status_period
  ON public.monthly_invoices_log (status, factuur_jaar, factuur_maand);

CREATE INDEX IF NOT EXISTS idx_monthly_invoices_log_lead
  ON public.monthly_invoices_log (lead_id);

CREATE TRIGGER trg_monthly_invoices_log_updated
  BEFORE UPDATE ON public.monthly_invoices_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
