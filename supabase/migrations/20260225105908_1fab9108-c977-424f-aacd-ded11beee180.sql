ALTER TABLE public.dba_checks
ADD COLUMN IF NOT EXISTS polis_file_url text,
ADD COLUMN IF NOT EXISTS polis_filename text,
ADD COLUMN IF NOT EXISTS polis_text text;