ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_account_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.exact_config.gl_account_ids IS 'Cache grootboekcode -> Exact GLAccount-ID (alleen via GET opgezocht).';
ALTER TABLE public.factuur_planning DROP CONSTRAINT IF EXISTS factuur_planning_status_check;
ALTER TABLE public.factuur_planning ADD CONSTRAINT factuur_planning_status_check CHECK (status = ANY (ARRAY['geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout','vervangen','geblokkeerd']));