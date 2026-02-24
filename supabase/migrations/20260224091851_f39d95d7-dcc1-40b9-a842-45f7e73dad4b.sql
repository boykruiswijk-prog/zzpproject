
ALTER TABLE public.dba_checks
  ADD COLUMN kvk_file_url TEXT,
  ADD COLUMN kvk_filename TEXT,
  ADD COLUMN kvk_text TEXT,
  ADD COLUMN kvk_check_result JSONB;
