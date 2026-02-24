
-- Configureerbare check velden voor Wet DBA
CREATE TABLE public.dba_check_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dba_check_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view fields" ON public.dba_check_fields
  FOR SELECT USING (is_team_member(auth.uid()));

CREATE POLICY "Admins can manage fields" ON public.dba_check_fields
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Standaard velden invoegen
INSERT INTO public.dba_check_fields (field_name, description, sort_order) VALUES
  ('Partijen', 'Opdrachtgever en opdrachtnemer met volledige bedrijfsgegevens', 1),
  ('KvK-nummer', 'KvK-nummer van de opdrachtnemer', 2),
  ('Opdrachomschrijving', 'Duidelijke beschrijving van de werkzaamheden', 3),
  ('Tarief en facturatie', 'Afgesproken tarief, facturatietermijn en betalingswijze', 4),
  ('Looptijd', 'Begin- en einddatum of duur van de opdracht', 5),
  ('Geen gezagsverhouding', 'Expliciete vermelding dat er geen arbeidsovereenkomst of gezagsverhouding is', 6),
  ('Vervanging', 'Mogelijkheid tot vervanging door de opdrachtnemer', 7),
  ('Aansprakelijkheid', 'Regeling rondom aansprakelijkheid en verzekeringen', 8),
  ('Intellectueel eigendom', 'Regeling rondom intellectueel eigendom', 9),
  ('Geheimhouding', 'Geheimhoudingsbepalingen', 10);

-- DBA checks tabel
CREATE TABLE public.dba_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  client_name TEXT NOT NULL,
  project_description TEXT,
  uploaded_file_url TEXT,
  original_filename TEXT,
  extracted_text TEXT,
  missing_fields JSONB DEFAULT '[]',
  field_results JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  rewritten_description TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  certificate_number TEXT,
  certificate_pdf_url TEXT,
  verification_token TEXT UNIQUE,
  certified_at TIMESTAMPTZ,
  certified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dba_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view dba checks" ON public.dba_checks
  FOR SELECT USING (is_team_member(auth.uid()));

CREATE POLICY "Team members can insert dba checks" ON public.dba_checks
  FOR INSERT WITH CHECK (is_team_member(auth.uid()));

CREATE POLICY "Team members can update dba checks" ON public.dba_checks
  FOR UPDATE USING (is_team_member(auth.uid()));

CREATE POLICY "Admins can delete dba checks" ON public.dba_checks
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for verification
CREATE POLICY "Anyone can verify by token" ON public.dba_checks
  FOR SELECT USING (verification_token IS NOT NULL AND status = 'certified');

CREATE TRIGGER update_dba_checks_updated_at
  BEFORE UPDATE ON public.dba_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence voor DBA certificaatnummers
CREATE SEQUENCE IF NOT EXISTS public.dba_cert_seq START 1001;

-- Storage bucket voor DBA documenten
INSERT INTO storage.buckets (id, name, public) VALUES ('dba-documents', 'dba-documents', false);

CREATE POLICY "Team members can upload dba docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dba-documents' AND is_team_member(auth.uid()));

CREATE POLICY "Team members can view dba docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'dba-documents' AND is_team_member(auth.uid()));

CREATE POLICY "Team members can delete dba docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'dba-documents' AND is_team_member(auth.uid()));
