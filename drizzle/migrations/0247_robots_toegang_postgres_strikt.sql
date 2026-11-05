-- Beheerverbinding alleen zonder meegegeven anon/authenticated-JWT; anders telt de gewone rolcontrole.
CREATE OR REPLACE FUNCTION public.robot_toegang(_extra_rollen app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (session_user = 'postgres' AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
      OR coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_extra_rollen)));
$$;
REVOKE ALL ON FUNCTION public.robot_toegang(app_role[]) FROM PUBLIC, anon, authenticated;