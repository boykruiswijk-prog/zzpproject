CREATE TABLE public.exact_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatiecode text NOT NULL,
  resultaat jsonb NOT NULL,
  gemaakt_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exact_controle_relatiecode_idx ON public.exact_controle (relatiecode, gemaakt_op DESC);
REVOKE ALL ON public.exact_controle FROM anon, authenticated;
GRANT SELECT ON public.exact_controle TO authenticated;
GRANT ALL ON public.exact_controle TO service_role;
ALTER TABLE public.exact_controle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin met 2FA leest exact_controle" ON public.exact_controle
  FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) AND coalesce(auth.jwt()->>'aal','') = 'aal2');
ALTER TABLE public.exact_stamdata_runs DROP CONSTRAINT exact_stamdata_runs_actie_check;
ALTER TABLE public.exact_stamdata_runs ADD CONSTRAINT exact_stamdata_runs_actie_check CHECK (actie IN ('proef','live','controle'));
ALTER TABLE public.exact_stamdata_runs DROP CONSTRAINT exact_stamdata_runs_onderdeel_check;
ALTER TABLE public.exact_stamdata_runs ADD CONSTRAINT exact_stamdata_runs_onderdeel_check CHECK (onderdeel IN ('telefoon','machtigingen','beide','controle'));