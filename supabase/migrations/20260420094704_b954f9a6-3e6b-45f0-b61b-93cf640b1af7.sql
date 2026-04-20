
-- 1. bav_aanmeldingen tabel
CREATE TABLE public.bav_aanmeldingen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  voornaam TEXT NOT NULL,
  achternaam TEXT NOT NULL,
  email TEXT NOT NULL,
  telefoon TEXT,
  bedrijfsnaam TEXT NOT NULL,
  kvk_nummer TEXT,
  beroep TEXT,
  sector TEXT,
  pakket TEXT NOT NULL,
  pakket_naam TEXT NOT NULL,
  betaalwijze TEXT NOT NULL,
  ingangsdatum DATE NOT NULL,
  maandpremie NUMERIC,
  jaarpremie NUMERIC,
  premiebedrag NUMERIC NOT NULL,
  iban TEXT,
  rekeninghouder TEXT,
  status TEXT NOT NULL DEFAULT 'nieuw',
  exact_status TEXT NOT NULL DEFAULT 'wachtend',
  exact_relatie_id TEXT,
  exact_abonnement_id TEXT,
  exact_sync_op TIMESTAMPTZ,
  exact_fout TEXT,
  aangemeld_op TIMESTAMPTZ NOT NULL DEFAULT now(),
  bijgewerkt_op TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bav_aanmeldingen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a bav aanmelding"
  ON public.bav_aanmeldingen FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Team members can view bav aanmeldingen"
  ON public.bav_aanmeldingen FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can update bav aanmeldingen"
  ON public.bav_aanmeldingen FOR UPDATE
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can delete bav aanmeldingen"
  ON public.bav_aanmeldingen FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER bav_aanmeldingen_set_updated_at
  BEFORE UPDATE ON public.bav_aanmeldingen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger gebruikt 'updated_at' kolomnaam, dus alias bijbenen via apart triggertje:
-- We gebruiken een eigen functie zodat 'bijgewerkt_op' wordt geupdate
CREATE OR REPLACE FUNCTION public.update_bijgewerkt_op_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.bijgewerkt_op = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bav_aanmeldingen_set_updated_at ON public.bav_aanmeldingen;
CREATE TRIGGER bav_aanmeldingen_set_bijgewerkt_op
  BEFORE UPDATE ON public.bav_aanmeldingen
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bijgewerkt_op_column();

-- 2. integratie_config tabel (alleen aan/uit-flag; credentials in secrets)
CREATE TABLE public.integratie_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naam TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  division TEXT,
  notities TEXT,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT now(),
  bijgewerkt_op TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integratie_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view integratie config"
  ON public.integratie_config FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can manage integratie config"
  ON public.integratie_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER integratie_config_set_bijgewerkt_op
  BEFORE UPDATE ON public.integratie_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bijgewerkt_op_column();

INSERT INTO public.integratie_config (naam, enabled)
VALUES ('exact_online', false);

-- 3. Exact-velden op leads (voor admin dashboard zichtbaarheid)
ALTER TABLE public.leads
  ADD COLUMN exact_status TEXT DEFAULT 'wachtend',
  ADD COLUMN exact_relatie_id TEXT,
  ADD COLUMN exact_abonnement_id TEXT,
  ADD COLUMN exact_sync_op TIMESTAMPTZ,
  ADD COLUMN exact_fout TEXT;
