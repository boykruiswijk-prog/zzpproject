
-- Create sequence for invoice numbers
CREATE SEQUENCE public.invoice_number_seq START WITH 1001;

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL DEFAULT '',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  
  -- Client details
  client_name TEXT NOT NULL,
  company_name TEXT,
  client_address TEXT,
  client_postcode TEXT,
  client_city TEXT,
  kvk_nummer TEXT,
  
  -- Invoice lines
  description TEXT NOT NULL DEFAULT 'Combinatiepolis Beroeps- en Bedrijfsaansprakelijkheid',
  package_type TEXT NOT NULL DEFAULT 'Combi Uitgebreid',
  amount_excl_btw NUMERIC(10,2) NOT NULL DEFAULT 0,
  btw_percentage NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  btw_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_incl_btw NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Payment
  payment_method TEXT NOT NULL DEFAULT 'Automatische incasso',
  payment_terms TEXT NOT NULL DEFAULT 'Wordt binnen 7 dagen automatisch geïncasseerd',
  bank_account TEXT NOT NULL DEFAULT 'NL00 BANK 0000 0000 00',
  bank_name TEXT NOT NULL DEFAULT 'ZP Zaken B.V.',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'concept',
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'ZPF-' || TO_CHAR(NEW.invoice_date, 'YYYY') || '-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_invoice_number_trigger
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- Auto-update updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view invoices"
ON public.invoices FOR SELECT
USING (is_team_member(auth.uid()));

CREATE POLICY "Team members can insert invoices"
ON public.invoices FOR INSERT
WITH CHECK (is_team_member(auth.uid()));

CREATE POLICY "Team members can update invoices"
ON public.invoices FOR UPDATE
USING (is_team_member(auth.uid()));

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
