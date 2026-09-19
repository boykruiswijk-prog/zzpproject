-- Throttle-administratie voor publieke formulieren. Alleen de edge functions
-- (service_role) schrijven en lezen hier; nooit de browser.
CREATE TABLE IF NOT EXISTS public.form_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_rate_limit_ip_kind_created_idx
  ON public.form_rate_limit (ip, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS form_rate_limit_created_idx
  ON public.form_rate_limit (created_at DESC);

GRANT ALL ON public.form_rate_limit TO service_role;

ALTER TABLE public.form_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins kunnen throttle-log lezen"
  ON public.form_rate_limit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Mislukte inlogpogingen per account, voor een tijdelijke afkoelperiode.
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text,
  succes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_email_created_idx
  ON public.login_attempts (lower(email), created_at DESC);

GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins kunnen inlogpogingen lezen"
  ON public.login_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Publieke formulieren gaan vanaf nu uitsluitend via de beveiligde edge functions
-- (honeypot + invultijd + IP-throttle). De browser mag niet meer direct schrijven.
DROP POLICY IF EXISTS "Allow anonymous lead submissions" ON public.leads;
DROP POLICY IF EXISTS "Anyone can sign up for a pilot" ON public.collective_signups;
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.collective_newsletter;
DROP POLICY IF EXISTS "Anyone can submit a suggestion" ON public.collective_suggestions;
DROP POLICY IF EXISTS "Anyone can submit a screening aanvraag" ON public.screening_aanvragen;
DROP POLICY IF EXISTS "Anyone can submit a bav aanmelding" ON public.bav_aanmeldingen;

REVOKE INSERT ON public.leads FROM anon;
REVOKE INSERT ON public.collective_signups FROM anon;
REVOKE INSERT ON public.collective_newsletter FROM anon;
REVOKE INSERT ON public.collective_suggestions FROM anon;
REVOKE INSERT ON public.screening_aanvragen FROM anon;
REVOKE INSERT ON public.bav_aanmeldingen FROM anon;