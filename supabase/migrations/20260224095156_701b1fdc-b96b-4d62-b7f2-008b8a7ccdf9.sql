
-- Add candidate details and document checklist to dba_checks
ALTER TABLE public.dba_checks
  ADD COLUMN IF NOT EXISTS candidate_email text,
  ADD COLUMN IF NOT EXISTS candidate_phone text,
  ADD COLUMN IF NOT EXISTS opdrachtgever text,
  ADD COLUMN IF NOT EXISTS eindopdrachtgever text,
  ADD COLUMN IF NOT EXISTS functie text,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS startdatum date,
  ADD COLUMN IF NOT EXISTS einddatum date,
  ADD COLUMN IF NOT EXISTS optie_verlenging text,
  ADD COLUMN IF NOT EXISTS uurtarief text,
  ADD COLUMN IF NOT EXISTS uren_per_week text,
  ADD COLUMN IF NOT EXISTS specifieke_vaardigheden text,
  ADD COLUMN IF NOT EXISTS rechtsvorm text,
  ADD COLUMN IF NOT EXISTS treedt_zelfstandig_op boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eigen_materiaal_werkwijze boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_checklist jsonb DEFAULT '{}';
