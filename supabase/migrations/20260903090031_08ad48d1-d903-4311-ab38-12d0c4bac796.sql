ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamp with time zone;

COMMENT ON COLUMN public.articles.content_reviewed_at IS
  'Datum waarop het artikel inhoudelijk is gecontroleerd/geactualiseerd. Los van updated_at (cosmetische wijzigingen). Wordt gebruikt als dateModified in het Article-schema.';