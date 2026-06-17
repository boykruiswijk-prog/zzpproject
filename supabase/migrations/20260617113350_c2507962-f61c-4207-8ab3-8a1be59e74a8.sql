ALTER TYPE public.lead_type ADD VALUE IF NOT EXISTS 'offerte-aanvraag';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS extra_data jsonb NOT NULL DEFAULT '{}'::jsonb;