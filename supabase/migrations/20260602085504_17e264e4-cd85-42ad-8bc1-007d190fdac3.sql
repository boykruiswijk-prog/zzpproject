-- Uitbreiding exact_config
ALTER TABLE public.exact_config
  ADD COLUMN IF NOT EXISTS redirect_uri TEXT,
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_obtained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

UPDATE public.exact_config
  SET base_url = 'https://start.exactonline.nl'
  WHERE base_url IS NULL OR base_url = '' OR base_url = 'https://start.exactonline.nl/api/v1';

-- CSRF state tokens
CREATE TABLE IF NOT EXISTS public.exact_oauth_state (
  state TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT ALL ON public.exact_oauth_state TO service_role;

ALTER TABLE public.exact_oauth_state ENABLE ROW LEVEL SECURITY;

-- Sync log
CREATE TABLE IF NOT EXISTS public.exact_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT,
  status TEXT,
  exact_account_id TEXT,
  error_message TEXT,
  payload JSONB,
  http_status INTEGER
);

GRANT SELECT ON public.exact_sync_log TO authenticated;
GRANT ALL ON public.exact_sync_log TO service_role;

ALTER TABLE public.exact_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sync log" ON public.exact_sync_log;
CREATE POLICY "Admins can read sync log"
  ON public.exact_sync_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_exact_sync_log_created
  ON public.exact_sync_log (created_at DESC);

-- Cleanup helper
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.exact_oauth_state WHERE expires_at < now();
END;
$$;