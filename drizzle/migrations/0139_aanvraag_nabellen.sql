ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS max_stap smallint;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS team_gemeld_op timestamptz;
UPDATE public.aanvraag_concepten SET max_stap = stap WHERE max_stap IS NULL;
CREATE INDEX IF NOT EXISTS aanvraag_concepten_nabellen_idx ON public.aanvraag_concepten (laatst_actief_op) WHERE status = 'open' AND team_gemeld_op IS NULL AND is_test = false;

CREATE TABLE public.aanvraag_validatiefouten (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formulier text NOT NULL DEFAULT 'bav',
  stap smallint NOT NULL CHECK (stap BETWEEN 1 AND 5),
  veld text NOT NULL CHECK (veld ~ '^[A-Za-z]{1,40}$'),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.aanvraag_validatiefouten IS 'Mislukte validaties per stap en veldnaam; nooit ingevulde waarden of persoonsgegevens.';
CREATE INDEX aanvraag_validatiefouten_tijd_idx ON public.aanvraag_validatiefouten (created_at);
GRANT SELECT ON public.aanvraag_validatiefouten TO authenticated;
GRANT ALL ON public.aanvraag_validatiefouten TO service_role;
ALTER TABLE public.aanvraag_validatiefouten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest validatiefouten" ON public.aanvraag_validatiefouten FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'verzekering'));