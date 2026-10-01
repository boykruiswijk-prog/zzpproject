REVOKE EXECUTE ON FUNCTION public.get_pilot_signup_count(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pilot_signup_count(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pilot_signup_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilot_signup_count(text) TO service_role;
COMMENT ON FUNCTION public.get_pilot_signup_count(text) IS 'Interne telling voor afgeschermd beheer; niet beschikbaar voor openbare bezoekers.';