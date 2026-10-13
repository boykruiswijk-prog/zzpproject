CREATE TABLE public.exact_telefoon_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatiecode text NOT NULL,
  telefoon text NOT NULL,
  status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw','proef_ok','overgeslagen_heeft_al','niet_gevonden','bijgewerkt','fout')),
  exact_account_id text,
  exact_telefoon_oud text,
  melding text,
  verwerkt_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.exact_telefoon_import FROM anon, authenticated;
GRANT SELECT ON public.exact_telefoon_import TO authenticated;
GRANT ALL ON public.exact_telefoon_import TO service_role;
ALTER TABLE public.exact_telefoon_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin met 2FA leest telefoonimport" ON public.exact_telefoon_import
  FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND coalesce(auth.jwt()->>'aal','') = 'aal2');

CREATE TABLE public.exact_stamdata_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestart timestamptz NOT NULL DEFAULT now(),
  geeindigd timestamptz,
  actie text NOT NULL CHECK (actie IN ('proef','live')),
  onderdeel text NOT NULL CHECK (onderdeel IN ('telefoon','machtigingen','beide')),
  gestart_door uuid,
  via text,
  aantallen jsonb NOT NULL DEFAULT '{}'::jsonb,
  fouten jsonb NOT NULL DEFAULT '[]'::jsonb,
  gestopt text
);
REVOKE ALL ON public.exact_stamdata_runs FROM anon, authenticated;
GRANT SELECT ON public.exact_stamdata_runs TO authenticated;
GRANT ALL ON public.exact_stamdata_runs TO service_role;
ALTER TABLE public.exact_stamdata_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin met 2FA leest stamdata-runs" ON public.exact_stamdata_runs
  FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND coalesce(auth.jwt()->>'aal','') = 'aal2');

ALTER TABLE public.klant_mandaten
  ADD COLUMN exact_status text,
  ADD COLUMN exact_melding text,
  ADD COLUMN exact_account_id text,
  ADD COLUMN exact_bankrekening_id text,
  ADD COLUMN exact_bankrekening_actie text,
  ADD COLUMN exact_mandaat_id text,
  ADD COLUMN exact_verwerkt_op timestamptz;
COMMENT ON COLUMN public.klant_mandaten.exact_status IS 'Verwerking door exact-stamdata-bijwerken: proef_ok, overgeslagen_bestaat_al, niet_gevonden, bijgewerkt, fout';