
-- Create policies/certificates table
CREATE TABLE public.policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  certificate_holder TEXT NOT NULL,
  insured_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  profession TEXT NOT NULL,
  package_type TEXT NOT NULL DEFAULT 'Combi Uitgebreid',
  bav_per_event TEXT NOT NULL DEFAULT '€ 5.000.000',
  bav_per_year TEXT NOT NULL DEFAULT '€ 15.000.000',
  avb_per_event TEXT NOT NULL DEFAULT '€ 2.500.000',
  avb_per_year TEXT NOT NULL DEFAULT '€ 5.000.000',
  own_risk TEXT NOT NULL DEFAULT 'ZP Zaken draagt de kosten voor het eigen risico.',
  coverage_area TEXT NOT NULL DEFAULT 'De verzekering biedt dekking ongeacht waar in de EU het handelen en/of nalaten zich heeft voorgedaan.',
  contract_duration TEXT NOT NULL DEFAULT '12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden, per direct opzegbaar.',
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by TEXT NOT NULL DEFAULT 'Michel Verheij',
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- Team members can view/manage policies
CREATE POLICY "Team members can view policies"
ON public.policies FOR SELECT
USING (is_team_member(auth.uid()));

CREATE POLICY "Team members can insert policies"
ON public.policies FOR INSERT
WITH CHECK (is_team_member(auth.uid()));

CREATE POLICY "Team members can update policies"
ON public.policies FOR UPDATE
USING (is_team_member(auth.uid()));

CREATE POLICY "Team members can delete policies"
ON public.policies FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_policies_updated_at
BEFORE UPDATE ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for certificate numbers
CREATE SEQUENCE public.policy_cert_seq START 5100;

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    NEW.certificate_number := 'ZPBAV' || nextval('public.policy_cert_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_certificate_number
BEFORE INSERT ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.generate_certificate_number();

-- Storage bucket for certificate PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);

-- Only team members can access certificates
CREATE POLICY "Team members can view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND is_team_member(auth.uid()));

CREATE POLICY "Team members can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND is_team_member(auth.uid()));

-- Service role can upload (for edge functions)
CREATE POLICY "Service role can manage certificates"
ON storage.objects FOR ALL
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');
