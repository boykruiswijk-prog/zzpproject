
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisor/admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisor/admin can delete roles" ON public.user_roles;

CREATE POLICY "Supervisor/admin can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE POLICY "Supervisor/admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));

-- Admins can view all roles → uitbreiden naar supervisor
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisor/admin can view all roles" ON public.user_roles;
CREATE POLICY "Supervisor/admin can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));
