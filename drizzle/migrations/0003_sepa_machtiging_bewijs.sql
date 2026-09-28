CREATE TABLE public.sepa_machtiging_bewijs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  dienst text NOT NULL CHECK (dienst IN ('bav','screening')),
  bron_tabel text NOT NULL,
  bron_id uuid NOT NULL,
  mandaatkenmerk text NOT NULL UNIQUE CHECK (char_length(mandaatkenmerk) <= 35),
  type text NOT NULL CHECK (type IN ('doorlopend','eenmalig')),
  incassant_naam text NOT NULL,
  incassant_id text NOT NULL,
  reden text NOT NULL,
  debiteur_naam text NOT NULL,
  debiteur_adres jsonb NOT NULL,
  iban text NOT NULL,
  tekst_versie text NOT NULL,
  getoonde_tekst text NOT NULL,
  tekst_hash text NOT NULL,
  akkoord_op timestamptz NOT NULL DEFAULT now(),
  client_akkoord_op timestamptz,
  ip_adres text,
  user_agent text,
  pagina_url text,
  bevestigingsmail_id text,
  bevestigingsmail_verzonden_op timestamptz
);
COMMENT ON TABLE public.sepa_machtiging_bewijs IS 'Onveranderbaar bewijsrecord per online SEPA-machtiging (BAV doorlopend, screening eenmalig). Alleen Edge Functions (service role) schrijven.';
CREATE INDEX sepa_machtiging_bewijs_bron_idx ON public.sepa_machtiging_bewijs (bron_id);

GRANT SELECT ON public.sepa_machtiging_bewijs TO authenticated;
GRANT ALL ON public.sepa_machtiging_bewijs TO service_role;
ALTER TABLE public.sepa_machtiging_bewijs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teamleden lezen SEPA-bewijs" ON public.sepa_machtiging_bewijs
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_sepa_machtiging_bewijs()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SEPA-bewijsrecord is onveranderbaar: verwijderen is niet toegestaan' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - 'bevestigingsmail_id' - 'bevestigingsmail_verzonden_op')
     IS DISTINCT FROM (to_jsonb(OLD) - 'bevestigingsmail_id' - 'bevestigingsmail_verzonden_op') THEN
    RAISE EXCEPTION 'SEPA-bewijsrecord is onveranderbaar: alleen bevestigingsmail-kolommen mogen eenmalig gevuld worden' USING ERRCODE = '42501';
  END IF;
  IF (NEW.bevestigingsmail_id IS DISTINCT FROM OLD.bevestigingsmail_id AND OLD.bevestigingsmail_id IS NOT NULL)
     OR (NEW.bevestigingsmail_verzonden_op IS DISTINCT FROM OLD.bevestigingsmail_verzonden_op AND OLD.bevestigingsmail_verzonden_op IS NOT NULL) THEN
    RAISE EXCEPTION 'SEPA-bewijsrecord: bevestigingsmail-kolommen zijn al gevuld' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_sepa_machtiging_bewijs
  BEFORE UPDATE OR DELETE ON public.sepa_machtiging_bewijs
  FOR EACH ROW EXECUTE FUNCTION public.guard_sepa_machtiging_bewijs();

CREATE POLICY "Teamleden lezen SEPA-machtiging PDF" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sepa-machtigingen' AND public.is_team_member(auth.uid()));