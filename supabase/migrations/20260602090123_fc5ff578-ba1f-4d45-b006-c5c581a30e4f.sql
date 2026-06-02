-- exact_tokens: alleen service_role
DROP POLICY IF EXISTS "Service role only" ON public.exact_tokens;
CREATE POLICY "Service role only"
  ON public.exact_tokens
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- exact_oauth_state: deny voor anon + authenticated (service_role bypasst RLS)
DROP POLICY IF EXISTS "No client access to oauth state" ON public.exact_oauth_state;
CREATE POLICY "No client access to oauth state"
  ON public.exact_oauth_state
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- cleanup functie: alleen backend mag deze aanroepen
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() TO service_role;