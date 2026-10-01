CREATE OR REPLACE FUNCTION public.get_pilot_signup_count(pilot text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_supervisor_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang tot collectieve aanmeldtellingen' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(*)::integer
    FROM public.collective_signups
    WHERE pilot_slug = pilot
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pilot_signup_count(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pilot_signup_count(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pilot_signup_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pilot_signup_count(text) TO service_role;
COMMENT ON FUNCTION public.get_pilot_signup_count(text) IS 'Interne telling; vereist een ingelogde admin- of supervisorrol.';