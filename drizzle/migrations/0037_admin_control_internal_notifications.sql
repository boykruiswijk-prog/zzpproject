CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_supervisor_or_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_supervisor_or_admin(uuid) TO authenticated, service_role;

CREATE TABLE public.interne_melding_ontvangers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email)) AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  actief boolean NOT NULL DEFAULT true,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  aangemaakt_door uuid REFERENCES auth.users(id),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interne_melding_ontvangers TO authenticated;
GRANT ALL ON public.interne_melding_ontvangers TO service_role;
ALTER TABLE public.interne_melding_ontvangers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin leest interne ontvangers"
ON public.interne_melding_ontvangers FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin voegt interne ontvangers toe"
ON public.interne_melding_ontvangers FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND aangemaakt_door = auth.uid() AND bijgewerkt_door = auth.uid());
CREATE POLICY "Admin wijzigt interne ontvangers"
ON public.interne_melding_ontvangers FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) AND bijgewerkt_door = auth.uid());
CREATE POLICY "Admin verwijdert interne ontvangers"
ON public.interne_melding_ontvangers FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Supervisor/admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisor/admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Supervisor/admin can view all roles" ON public.user_roles;
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Supervisor/admin can read sensitive audit log" ON public.sensitive_audit_log;
CREATE POLICY "Admin can read sensitive audit log" ON public.sensitive_audit_log FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.sensitive_audit_log FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins can read notification log" ON public.lead_notification_log;
CREATE POLICY "Admin can read notification log" ON public.lead_notification_log FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.zet_facturatie_actief(_aan boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Alleen admin mag facturatie wijzigen';
  END IF;
  UPDATE public.facturatie_config
  SET facturatie_actief = _aan, bijgewerkt_door = auth.uid(), bijgewerkt_op = now()
  WHERE id = 1;
  RETURN _aan;
END;
$$;

CREATE OR REPLACE FUNCTION public.zet_opzeg_credits_actief(_aan boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Alleen admin mag opzegcredits wijzigen';
  END IF;
  UPDATE public.facturatie_config
  SET opzeg_credits_actief = _aan, bijgewerkt_door = auth.uid(), bijgewerkt_op = now()
  WHERE id = 1;
  RETURN _aan;
END;
$$;
REVOKE ALL ON FUNCTION public.zet_facturatie_actief(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zet_facturatie_actief(boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.zet_opzeg_credits_actief(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zet_opzeg_credits_actief(boolean) TO authenticated;

DROP POLICY IF EXISTS "Only admins can manage exact config" ON public.exact_config;
CREATE POLICY "Admin manages exact config" ON public.exact_config FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage integratie config" ON public.integratie_config;
CREATE POLICY "Admin manages integratie config" ON public.integratie_config FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));