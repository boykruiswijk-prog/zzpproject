CREATE OR REPLACE FUNCTION public.mag_crm_beeindigen(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_team_member(_uid) AND (public.is_supervisor_or_admin(_uid) OR public.has_role(_uid, 'verzekering') OR public.has_role(_uid, 'medewerker'))
$$;