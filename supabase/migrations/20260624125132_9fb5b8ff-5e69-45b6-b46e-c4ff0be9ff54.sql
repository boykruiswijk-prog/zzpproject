
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS polis_einddatum DATE
    GENERATED ALWAYS AS ((ingangsdatum + INTERVAL '1 year' - INTERVAL '1 day')::date) STORED,
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_id_pauze TEXT,
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_bedrag NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_aangemaakt_op TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exact_factuur_id_hervat TEXT,
  ADD COLUMN IF NOT EXISTS exact_factuur_bedrag_hervat NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS exact_factuur_aangemaakt_op_hervat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exact_invoice_status SMALLINT;
