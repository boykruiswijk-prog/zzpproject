-- 1) Bestaande rollen migreren
UPDATE public.user_roles SET role = 'supervisor'::public.app_role WHERE role = 'admin'::public.app_role;
UPDATE public.user_roles SET role = 'verzekering'::public.app_role WHERE role = 'medewerker'::public.app_role;

-- 2) has_role herdefiniëren: 'admin' matcht óók supervisor (backwards compat voor bestaande RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'supervisor'::public.app_role)
      )
  );
$$;

-- 3) is_supervisor_or_admin blijft supervisor-only (admin bestaat feitelijk niet meer)
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'supervisor'::public.app_role
  );
$$;