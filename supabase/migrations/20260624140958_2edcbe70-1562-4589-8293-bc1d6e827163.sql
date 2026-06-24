-- Opzeg-credit velden gescheiden van pauze-velden om co-existentie te ondersteunen
-- en traceability in admin lifecycle.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_id_opzeg text NULL,
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_bedrag_opzeg numeric NULL,
  ADD COLUMN IF NOT EXISTS exact_credit_invoice_aangemaakt_op_opzeg timestamptz NULL;