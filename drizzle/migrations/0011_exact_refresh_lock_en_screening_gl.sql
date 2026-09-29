ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS refresh_lock_until timestamptz;
COMMENT ON COLUMN public.exact_config.refresh_lock_until IS 'Lock voor Exact-tokenrefresh (_shared/exactToken.ts); alleen de houder ververst';
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_code_screening text;
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS vat_code_screening text;
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_account_id_screening uuid;
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_account_id_screening_code text;