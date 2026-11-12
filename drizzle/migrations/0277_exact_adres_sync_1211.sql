-- Akkoord Boy 12-11-2026 13:50: adreswijzigingen van ondernemingen met Exact-relatie doorzetten naar Exact (alleen adresvelden).
CREATE TABLE public.exact_adres_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  exact_account_id uuid NOT NULL,
  bron text NOT NULL DEFAULT 'wijziging',
  status text NOT NULL DEFAULT 'wacht' CHECK (status IN ('wacht','bijgewerkt','gelijk','twijfel','fout')),
  pogingen integer NOT NULL DEFAULT 0,
  laatste_melding text,
  exact_oud jsonb,
  exact_nieuw jsonb,
  melding_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  verwerkt_op timestamptz
);
CREATE UNIQUE INDEX exact_adres_sync_een_open ON public.exact_adres_sync (onderneming_id) WHERE status IN ('wacht','fout');
GRANT SELECT ON public.exact_adres_sync TO authenticated;
GRANT ALL ON public.exact_adres_sync TO service_role;
ALTER TABLE public.exact_adres_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest adressync" ON public.exact_adres_sync FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.exact_adres_wachtrij()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.exact_account_id IS NULL OR coalesce(NEW.is_test,false) OR NEW.samengevoegd_naar IS NOT NULL THEN RETURN NEW; END IF;
  IF (NEW.straat, NEW.huisnummer, NEW.postcode, NEW.plaats) IS NOT DISTINCT FROM (OLD.straat, OLD.huisnummer, OLD.postcode, OLD.plaats) THEN RETURN NEW; END IF;
  INSERT INTO public.exact_adres_sync (onderneming_id, exact_account_id, bron)
  VALUES (NEW.id, NEW.exact_account_id::uuid, 'wijziging')
  ON CONFLICT (onderneming_id) WHERE status IN ('wacht','fout')
  DO UPDATE SET status = 'wacht', exact_account_id = EXCLUDED.exact_account_id, bijgewerkt_op = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'exact_adres_wachtrij: %', SQLERRM; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.exact_adres_wachtrij() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_exact_adres_wachtrij AFTER UPDATE OF straat, huisnummer, postcode, plaats ON public.ondernemingen
  FOR EACH ROW EXECUTE FUNCTION public.exact_adres_wachtrij();