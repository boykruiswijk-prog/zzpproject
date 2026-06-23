
-- 1. Extend lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'nieuw_te_beoordelen';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'actief';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'gepauzeerd';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'opgezegd';

-- 2. Add new columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS sepa_akkoord boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sepa_akkoord_datum timestamptz,
  ADD COLUMN IF NOT EXISTS adres_straat text,
  ADD COLUMN IF NOT EXISTS adres_huisnummer text,
  ADD COLUMN IF NOT EXISTS adres_postcode text,
  ADD COLUMN IF NOT EXISTS adres_plaats text,
  ADD COLUMN IF NOT EXISTS branche text,
  ADD COLUMN IF NOT EXISTS exact_account_id text,
  ADD COLUMN IF NOT EXISTS geactiveerd_door uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS geactiveerd_op timestamptz,
  ADD COLUMN IF NOT EXISTS activatie_log jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Add lead_id to exact_sync_log so we can correlate activations
ALTER TABLE public.exact_sync_log
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES auth.users(id);
