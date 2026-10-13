CREATE TABLE public.exact_betaalconditie_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderdeel text NOT NULL DEFAULT 'betaalconditie' CHECK (onderdeel IN ('betaalconditie','mandaat_main')),
  relatiecode text NOT NULL,
  onderneming_id uuid,
  exact_account_id text,
  conditie_oud text,
  exact_mandaat_id text,
  status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw','proef_ok','al_incasso','geen_mandaat','wacht_op_mandaat','al_main','niet_van_toepassing','niet_gevonden','bijgewerkt','fout')),
  melding text,
  verwerkt_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onderdeel, relatiecode)
);
REVOKE ALL ON public.exact_betaalconditie_import FROM anon, authenticated;
GRANT SELECT ON public.exact_betaalconditie_import TO authenticated;
GRANT ALL ON public.exact_betaalconditie_import TO service_role;
ALTER TABLE public.exact_betaalconditie_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin met 2FA leest betaalconditie-import" ON public.exact_betaalconditie_import
  FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND coalesce(auth.jwt()->>'aal','') = 'aal2');
ALTER TABLE public.exact_stamdata_runs DROP CONSTRAINT exact_stamdata_runs_onderdeel_check;
ALTER TABLE public.exact_stamdata_runs ADD CONSTRAINT exact_stamdata_runs_onderdeel_check CHECK (onderdeel IN ('telefoon','machtigingen','beide','controle','betaalconditie','mandaat_main','alles'));