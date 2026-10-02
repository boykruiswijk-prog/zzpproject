ALTER TABLE public.ondernemingen ADD COLUMN IF NOT EXISTS branche text, ADD COLUMN IF NOT EXISTS sector text;
COMMENT ON COLUMN public.ondernemingen.branche IS 'Adminbranche (hoedanigheid op certificaat), afgeleid van sector via sectorBranche';
COMMENT ON COLUMN public.ondernemingen.sector IS 'Wizard-sectorlabel ("In welk vak werk je vooral?")';