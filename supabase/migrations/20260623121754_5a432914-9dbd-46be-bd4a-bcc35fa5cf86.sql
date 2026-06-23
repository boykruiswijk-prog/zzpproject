ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS exact_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS exact_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS exact_invoice_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS exact_invoice_created_at TIMESTAMPTZ;