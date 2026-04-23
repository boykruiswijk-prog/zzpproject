-- Portal: koppel polissen/facturen aan klant-accounts via invite-only flow

-- 1. user_id toevoegen aan policies en invoices (nullable; bestaande records blijven werken)
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_policies_user_id ON public.policies(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

-- 2. RLS: klant ziet eigen polis/factuur (naast bestaande team-policies)
CREATE POLICY "Customers can view their own policies"
  ON public.policies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Customers can view their own invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. portal_invitations tabel
CREATE TABLE IF NOT EXISTS public.portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | expired
  invited_by uuid REFERENCES auth.users(id),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_invitations_email ON public.portal_invitations(email);
CREATE INDEX IF NOT EXISTS idx_portal_invitations_token ON public.portal_invitations(token);

ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage invitations"
  ON public.portal_invitations FOR ALL
  TO authenticated
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));

-- 4. exact_config (single-row, alleen admins)
CREATE TABLE IF NOT EXISTS public.exact_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  divisie_code text,
  base_url text DEFAULT 'https://start.exactonline.nl/api/v1',
  is_actief boolean NOT NULL DEFAULT false,
  laatste_sync timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exact_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage exact config"
  ON public.exact_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- één lege config-rij zodat de UI altijd een record heeft om te lezen/updaten
INSERT INTO public.exact_config (is_actief)
SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.exact_config);

-- 5. RPC: invitation accepteren + automatisch policies/invoices koppelen op email match
CREATE OR REPLACE FUNCTION public.accept_portal_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.portal_invitations%ROWTYPE;
  _uid uuid := auth.uid();
  _user_email text;
  _lead_email text;
  _policy_count int := 0;
  _invoice_count int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _invite FROM public.portal_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'already_accepted', true);
  END IF;

  IF _invite.expires_at < now() THEN
    UPDATE public.portal_invitations SET status = 'expired' WHERE id = _invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _uid;
  IF lower(_user_email) <> lower(_invite.email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  -- markeer invitation als geaccepteerd
  UPDATE public.portal_invitations
     SET status = 'accepted', user_id = _uid, accepted_at = now()
   WHERE id = _invite.id;

  -- koppel polissen/facturen via lead_id (primair) en via lead-email als fallback
  IF _invite.lead_id IS NOT NULL THEN
    SELECT email INTO _lead_email FROM public.leads WHERE id = _invite.lead_id;

    UPDATE public.policies SET user_id = _uid
     WHERE user_id IS NULL AND lead_id = _invite.lead_id;
    GET DIAGNOSTICS _policy_count = ROW_COUNT;

    UPDATE public.invoices SET user_id = _uid
     WHERE user_id IS NULL AND lead_id = _invite.lead_id;
    GET DIAGNOSTICS _invoice_count = ROW_COUNT;
  END IF;

  -- fallback: ook polissen/facturen koppelen via leads waarvan email matcht
  UPDATE public.policies p SET user_id = _uid
   WHERE p.user_id IS NULL
     AND p.lead_id IN (SELECT id FROM public.leads WHERE lower(email) = lower(_invite.email));

  UPDATE public.invoices i SET user_id = _uid
   WHERE i.user_id IS NULL
     AND i.lead_id IN (SELECT id FROM public.leads WHERE lower(email) = lower(_invite.email));

  RETURN jsonb_build_object(
    'success', true,
    'policies_linked', _policy_count,
    'invoices_linked', _invoice_count
  );
END;
$$;

-- 6. Storage buckets voor klant-documenten (private, alleen eigenaar leest via signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('klant-documenten', 'klant-documenten', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Customers read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'klant-documenten'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Team members manage klant documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'klant-documenten' AND public.is_team_member(auth.uid()))
  WITH CHECK (bucket_id = 'klant-documenten' AND public.is_team_member(auth.uid()));
