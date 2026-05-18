-- 1. exact_tokens table
CREATE TABLE public.exact_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  division_code text NOT NULL,
  environment text NOT NULL DEFAULT 'test',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exact_tokens_environment_check CHECK (environment IN ('test','production')),
  CONSTRAINT exact_tokens_environment_unique UNIQUE (environment)
);

ALTER TABLE public.exact_tokens ENABLE ROW LEVEL SECURITY;
-- Geen policies = niemand kan via anon/authenticated. Alleen service_role bypassed RLS.

CREATE TRIGGER update_exact_tokens_updated_at
  BEFORE UPDATE ON public.exact_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. exact_subscription_mapping table
CREATE TABLE public.exact_subscription_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pakket_naam text NOT NULL UNIQUE,
  exact_subscription_type_id text NOT NULL,
  omschrijving text,
  actief boolean NOT NULL DEFAULT true,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exact_subscription_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view subscription mapping"
  ON public.exact_subscription_mapping FOR SELECT
  TO authenticated USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can manage subscription mapping"
  ON public.exact_subscription_mapping FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.exact_subscription_mapping (pakket_naam, exact_subscription_type_id, omschrijving) VALUES
  ('BAV Basis', 'TODO_VUL_GUID_IN', 'BAV Basisdekking'),
  ('BAV Plus', 'TODO_VUL_GUID_IN', 'BAV Uitgebreide dekking'),
  ('BAV Compleet', 'TODO_VUL_GUID_IN', 'BAV Compleet pakket');

-- 3. bav_aanmeldingen extra kolommen
ALTER TABLE public.bav_aanmeldingen
  ADD COLUMN IF NOT EXISTS exact_account_id text,
  ADD COLUMN IF NOT EXISTS exact_subscription_id text,
  ADD COLUMN IF NOT EXISTS exact_gesynchroniseerd_op timestamptz,
  ADD COLUMN IF NOT EXISTS exact_foutmelding text;