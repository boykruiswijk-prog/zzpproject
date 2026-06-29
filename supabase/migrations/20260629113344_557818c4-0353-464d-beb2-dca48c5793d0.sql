
-- 1) Helpers
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_label(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'service_role'
    ELSE COALESCE(
      (SELECT role::text FROM public.user_roles
        WHERE user_id = _user_id
        ORDER BY CASE role::text
          WHEN 'admin' THEN 1
          WHEN 'supervisor' THEN 2
          WHEN 'medewerker' THEN 3
          ELSE 9
        END
        LIMIT 1),
      'onbekend'
    )
  END
$$;

-- 2) Audit-log tabel
CREATE TABLE IF NOT EXISTS public.sensitive_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_table text NOT NULL,
  target_id uuid,
  actie text NOT NULL,
  veld text,
  oude_waarde text,
  nieuwe_waarde text,
  uitgevoerd_door uuid,
  uitgevoerd_door_email text,
  uitgevoerd_door_rol text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensitive_audit_log_target
  ON public.sensitive_audit_log (target_table, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitive_audit_log_created
  ON public.sensitive_audit_log (created_at DESC);

GRANT SELECT ON public.sensitive_audit_log TO authenticated;
GRANT ALL ON public.sensitive_audit_log TO service_role;

ALTER TABLE public.sensitive_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisor/admin can read sensitive audit log" ON public.sensitive_audit_log;
CREATE POLICY "Supervisor/admin can read sensitive audit log"
ON public.sensitive_audit_log
FOR SELECT
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));

-- 3) polis_audit_log strikter
DROP POLICY IF EXISTS "Admins kunnen audit log inzien" ON public.polis_audit_log;
DROP POLICY IF EXISTS "Supervisor/admin kunnen polis-audit log inzien" ON public.polis_audit_log;
CREATE POLICY "Supervisor/admin kunnen polis-audit log inzien"
ON public.polis_audit_log
FOR SELECT
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));

-- 4) Lead-DELETE: supervisor/admin
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Supervisor/admin can delete leads" ON public.leads;
CREATE POLICY "Supervisor/admin can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));

-- 5) Policies-DELETE: supervisor/admin
DROP POLICY IF EXISTS "Team members can delete policies" ON public.policies;
DROP POLICY IF EXISTS "Supervisor/admin can delete policies" ON public.policies;
CREATE POLICY "Supervisor/admin can delete policies"
ON public.policies
FOR DELETE
TO authenticated
USING (public.is_supervisor_or_admin(auth.uid()));

-- 6) Trigger: bewaak gevoelige velden + statuswijzigingen op leads
CREATE OR REPLACE FUNCTION public.guard_lead_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_activated boolean;
  _is_terminating boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_supervisor_or_admin(_uid) THEN
    RETURN NEW;
  END IF;

  _is_activated := (OLD.geactiveerd_op IS NOT NULL)
                   OR (OLD.status IN ('actief'::lead_status, 'gepauzeerd'::lead_status, 'opgezegd'::lead_status));

  _is_terminating := (NEW.status IS DISTINCT FROM OLD.status) AND (
       NEW.status = 'opgezegd'::lead_status
    OR (OLD.status IN ('actief'::lead_status, 'gepauzeerd'::lead_status, 'opgezegd'::lead_status)
        AND NEW.status NOT IN ('actief'::lead_status, 'gepauzeerd'::lead_status, 'opgezegd'::lead_status))
  );

  IF _is_terminating THEN
    RAISE EXCEPTION 'Niet toegestaan: opzeggen of activatie terugdraaien is voorbehouden aan supervisor/admin.'
      USING ERRCODE = '42501';
  END IF;

  IF _is_activated THEN
    IF NEW.iban IS DISTINCT FROM OLD.iban
       OR NEW.verzekerd_bedrag IS DISTINCT FROM OLD.verzekerd_bedrag
       OR NEW.gekozen_pakket IS DISTINCT FROM OLD.gekozen_pakket
       OR NEW.eigen_risico IS DISTINCT FROM OLD.eigen_risico
       OR NEW.exact_invoice_amount IS DISTINCT FROM OLD.exact_invoice_amount
    THEN
      RAISE EXCEPTION 'Niet toegestaan: IBAN, dekkingsbedrag, pakket, eigen risico en premie/bedrag van een actieve polis mogen alleen door supervisor/admin gewijzigd worden.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lead_sensitive_changes ON public.leads;
CREATE TRIGGER trg_guard_lead_sensitive_changes
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.guard_lead_sensitive_changes();

-- 7) Trigger op policies
CREATE OR REPLACE FUNCTION public.guard_policy_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF public.is_supervisor_or_admin(_uid) THEN RETURN NEW; END IF;

  IF NEW.package_type IS DISTINCT FROM OLD.package_type
     OR NEW.bav_per_event IS DISTINCT FROM OLD.bav_per_event
     OR NEW.bav_per_year IS DISTINCT FROM OLD.bav_per_year
     OR NEW.avb_per_event IS DISTINCT FROM OLD.avb_per_event
     OR NEW.avb_per_year IS DISTINCT FROM OLD.avb_per_year
     OR NEW.own_risk IS DISTINCT FROM OLD.own_risk
  THEN
    RAISE EXCEPTION 'Niet toegestaan: dekkings- en pakketvelden op een polis mogen alleen door supervisor/admin gewijzigd worden.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_policy_sensitive_changes ON public.policies;
CREATE TRIGGER trg_guard_policy_sensitive_changes
BEFORE UPDATE ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.guard_policy_sensitive_changes();

-- 8) Audit-log triggers op leads
CREATE OR REPLACE FUNCTION public.log_lead_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _rol text := public.get_user_role_label(_uid);
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
    VALUES ('leads', OLD.id, 'lead_verwijderd', _uid, _email, _rol,
            jsonb_build_object('email', OLD.email, 'voornaam', OLD.voornaam, 'achternaam', OLD.achternaam, 'status', OLD.status));
    RETURN OLD;
  END IF;

  IF NEW.iban IS DISTINCT FROM OLD.iban THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'veld_gewijzigd', 'iban', OLD.iban, NEW.iban, _uid, _email, _rol);
  END IF;
  IF NEW.verzekerd_bedrag IS DISTINCT FROM OLD.verzekerd_bedrag THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'veld_gewijzigd', 'verzekerd_bedrag', OLD.verzekerd_bedrag, NEW.verzekerd_bedrag, _uid, _email, _rol);
  END IF;
  IF NEW.gekozen_pakket IS DISTINCT FROM OLD.gekozen_pakket THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'veld_gewijzigd', 'gekozen_pakket', OLD.gekozen_pakket, NEW.gekozen_pakket, _uid, _email, _rol);
  END IF;
  IF NEW.eigen_risico IS DISTINCT FROM OLD.eigen_risico THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'veld_gewijzigd', 'eigen_risico', OLD.eigen_risico, NEW.eigen_risico, _uid, _email, _rol);
  END IF;
  IF NEW.exact_invoice_amount IS DISTINCT FROM OLD.exact_invoice_amount THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'veld_gewijzigd', 'exact_invoice_amount', OLD.exact_invoice_amount::text, NEW.exact_invoice_amount::text, _uid, _email, _rol);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (
       NEW.status = 'opgezegd'::lead_status
    OR (OLD.status IN ('actief'::lead_status, 'gepauzeerd'::lead_status, 'opgezegd'::lead_status)
        AND NEW.status NOT IN ('actief'::lead_status, 'gepauzeerd'::lead_status, 'opgezegd'::lead_status))
  ) THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'status_gewijzigd_gevoelig', 'status', OLD.status::text, NEW.status::text, _uid, _email, _rol);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_sensitive_update ON public.leads;
CREATE TRIGGER trg_log_lead_sensitive_update
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_sensitive_changes();

DROP TRIGGER IF EXISTS trg_log_lead_sensitive_delete ON public.leads;
CREATE TRIGGER trg_log_lead_sensitive_delete
AFTER DELETE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_sensitive_changes();

-- 9) Audit-log triggers op policies
CREATE OR REPLACE FUNCTION public.log_policy_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _rol text := public.get_user_role_label(_uid);
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
    VALUES ('policies', OLD.id, 'polis_verwijderd', _uid, _email, _rol,
            jsonb_build_object('certificate_number', OLD.certificate_number));
    RETURN OLD;
  END IF;

  IF NEW.package_type IS DISTINCT FROM OLD.package_type THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('policies', NEW.id, 'veld_gewijzigd', 'package_type', OLD.package_type, NEW.package_type, _uid, _email, _rol);
  END IF;
  IF NEW.bav_per_event IS DISTINCT FROM OLD.bav_per_event THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('policies', NEW.id, 'veld_gewijzigd', 'bav_per_event', OLD.bav_per_event, NEW.bav_per_event, _uid, _email, _rol);
  END IF;
  IF NEW.avb_per_event IS DISTINCT FROM OLD.avb_per_event THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('policies', NEW.id, 'veld_gewijzigd', 'avb_per_event', OLD.avb_per_event, NEW.avb_per_event, _uid, _email, _rol);
  END IF;
  IF NEW.own_risk IS DISTINCT FROM OLD.own_risk THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol)
    VALUES ('policies', NEW.id, 'veld_gewijzigd', 'own_risk', OLD.own_risk, NEW.own_risk, _uid, _email, _rol);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_policy_sensitive_update ON public.policies;
CREATE TRIGGER trg_log_policy_sensitive_update
AFTER UPDATE ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.log_policy_sensitive_changes();

DROP TRIGGER IF EXISTS trg_log_policy_sensitive_delete ON public.policies;
CREATE TRIGGER trg_log_policy_sensitive_delete
AFTER DELETE ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.log_policy_sensitive_changes();
