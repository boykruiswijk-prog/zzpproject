CREATE TABLE public.exact_mandaat_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatiecode text UNIQUE NOT NULL,
  naam text NOT NULL,
  iban text NOT NULL,
  kenmerk text UNIQUE NOT NULL CHECK (char_length(kenmerk) <= 35),
  ondertekend_op date NOT NULL,
  status text NOT NULL DEFAULT 'wachtend' CHECK (status IN ('wachtend','droogrun_ok','bijgewerkt','overgeslagen_bestaat_al','niet_gevonden','naam_afwijkend','andere_machtiging_aanwezig','fout')),
  exact_account_id text,
  exact_naam text,
  exact_bankrekening_id text,
  bankrekening_actie text CHECK (bankrekening_actie IS NULL OR bankrekening_actie IN ('bestaand','aanmaken','aangemaakt')),
  exact_mandaat_id text,
  bestaande_mandaten jsonb,
  melding text,
  verwerkt_op timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.exact_mandaat_import TO authenticated;
GRANT ALL ON public.exact_mandaat_import TO service_role;
ALTER TABLE public.exact_mandaat_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors en admins lezen mandaatimport" ON public.exact_mandaat_import
  FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));