-- 1) Nieuwe rolwaarden toevoegen aan het enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verzekering';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing';