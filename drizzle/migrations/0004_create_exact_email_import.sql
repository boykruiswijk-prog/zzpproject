CREATE TABLE public.exact_email_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatiecode text UNIQUE NOT NULL,
  naam text NOT NULL,
  email text NOT NULL,
  excel_rij int,
  niet_gevonden_volgens_excel boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'wachtend' CHECK (status IN ('wachtend','droogrun_ok','bijgewerkt','overgeslagen_heeft_al_email','niet_gevonden','naam_afwijkend','fout')),
  exact_account_id text,
  exact_naam text,
  exact_email_voor text,
  melding text,
  verwerkt_op timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.exact_email_import TO authenticated;
GRANT ALL ON public.exact_email_import TO service_role;
ALTER TABLE public.exact_email_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin lezen e-mailimport" ON public.exact_email_import
  FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));