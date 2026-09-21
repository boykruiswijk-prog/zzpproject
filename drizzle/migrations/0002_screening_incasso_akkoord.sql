ALTER TABLE public.screening_aanvragen
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS rekeninghouder TEXT,
  ADD COLUMN IF NOT EXISTS incasso_akkoord BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incasso_akkoord_op TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bedrag NUMERIC,
  ADD COLUMN IF NOT EXISTS incasso_status TEXT NOT NULL DEFAULT 'handmatig_te_verwerken',
  ADD COLUMN IF NOT EXISTS exact_status TEXT NOT NULL DEFAULT 'wachtend',
  ADD COLUMN IF NOT EXISTS exact_relatie_id TEXT,
  ADD COLUMN IF NOT EXISTS exact_transactie_id TEXT,
  ADD COLUMN IF NOT EXISTS exact_sync_op TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exact_fout TEXT;

COMMENT ON COLUMN public.screening_aanvragen.incasso_akkoord IS 'Expliciet akkoord per dienst voor eenmalige incasso van het screeningbedrag (geen doorlopende machtiging).';
COMMENT ON COLUMN public.screening_aanvragen.incasso_status IS 'handmatig_te_verwerken | in_behandeling | verwerkt — zolang de Exact-koppeling uit staat blijft dit handmatig_te_verwerken.';