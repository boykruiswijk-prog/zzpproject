CREATE TABLE public.aanvraag_concepten (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  laatst_actief_op timestamptz NOT NULL DEFAULT now(),
  stap smallint NOT NULL DEFAULT 1 CHECK (stap BETWEEN 1 AND 5),
  email text,
  telefoon text,
  voornaam text,
  achternaam text,
  bedrijfsnaam text,
  kvk text,
  pakket text,
  sector text,
  pagina text,
  attributie jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','omgezet','gebeld','geen_interesse','onbereikbaar')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  opvolg_notitie text,
  opgevolgd_door uuid,
  opgevolgd_op timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  geanonimiseerd_op timestamptz
);
COMMENT ON TABLE public.aanvraag_concepten IS 'Onvoltooide BAV-aanvragen. Nooit IBAN, rekeninghouder of SEPA-gegevens. Na 90 dagen geanonimiseerd, nooit verwijderd.';
CREATE INDEX aanvraag_concepten_status_idx ON public.aanvraag_concepten (status, laatst_actief_op DESC);

GRANT SELECT, UPDATE ON public.aanvraag_concepten TO authenticated;
GRANT ALL ON public.aanvraag_concepten TO service_role;
ALTER TABLE public.aanvraag_concepten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team leest concepten" ON public.aanvraag_concepten FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'));
CREATE POLICY "Team werkt concepten bij" ON public.aanvraag_concepten FOR UPDATE TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'))
  WITH CHECK (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'));

CREATE OR REPLACE FUNCTION public.anonimiseer_aanvraag_concepten()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.aanvraag_concepten SET
    email = NULL, telefoon = NULL, voornaam = NULL, achternaam = NULL, bedrijfsnaam = NULL, kvk = NULL,
    opvolg_notitie = NULL, attributie = NULL, geanonimiseerd_op = now()
  WHERE status <> 'omgezet' AND geanonimiseerd_op IS NULL AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.anonimiseer_aanvraag_concepten() FROM PUBLIC, anon, authenticated;