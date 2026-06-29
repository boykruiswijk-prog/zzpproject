
-- Audit trigger voor leads
CREATE OR REPLACE FUNCTION public.audit_lead_sensitive_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _role text;
  _was_active boolean;
  _is_terminating boolean;
  _rev_activation boolean;
  _changed text[] := ARRAY[]::text[];
  c text;
BEGIN
  -- Wie heeft het gedaan
  SELECT au.email INTO _email FROM auth.users au WHERE au.id = _uid;
  SELECT ur.role::text INTO _role FROM public.user_roles ur WHERE ur.user_id = _uid ORDER BY 1 LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol,details)
    VALUES ('leads', OLD.id, 'delete', NULL, to_jsonb(OLD)::text, NULL, _uid, _email, _role, jsonb_build_object('status', OLD.status));
    RETURN OLD;
  END IF;

  _was_active := (OLD.geactiveerd_op IS NOT NULL)
                 OR (OLD.status IN ('actief'::lead_status,'gepauzeerd'::lead_status,'opgezegd'::lead_status));
  _is_terminating := (NEW.status IS DISTINCT FROM OLD.status) AND NEW.status='opgezegd'::lead_status;
  _rev_activation := (NEW.status IS DISTINCT FROM OLD.status)
                     AND OLD.status IN ('actief'::lead_status,'gepauzeerd'::lead_status,'opgezegd'::lead_status)
                     AND NEW.status NOT IN ('actief'::lead_status,'gepauzeerd'::lead_status,'opgezegd'::lead_status);

  IF _is_terminating THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'opzeggen', 'status', OLD.status::text, NEW.status::text, _uid, _email, _role);
  END IF;
  IF _rev_activation THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('leads', NEW.id, 'activatie_terugdraaien', 'status', OLD.status::text, NEW.status::text, _uid, _email, _role);
  END IF;

  IF _was_active THEN
    IF NEW.iban IS DISTINCT FROM OLD.iban THEN
      INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
      VALUES ('leads',NEW.id,'wijziging_gevoelig_veld','iban',OLD.iban,NEW.iban,_uid,_email,_role);
    END IF;
    IF NEW.verzekerd_bedrag IS DISTINCT FROM OLD.verzekerd_bedrag THEN
      INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
      VALUES ('leads',NEW.id,'wijziging_gevoelig_veld','verzekerd_bedrag',OLD.verzekerd_bedrag,NEW.verzekerd_bedrag,_uid,_email,_role);
    END IF;
    IF NEW.gekozen_pakket IS DISTINCT FROM OLD.gekozen_pakket THEN
      INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
      VALUES ('leads',NEW.id,'wijziging_gevoelig_veld','gekozen_pakket',OLD.gekozen_pakket,NEW.gekozen_pakket,_uid,_email,_role);
    END IF;
    IF NEW.eigen_risico IS DISTINCT FROM OLD.eigen_risico THEN
      INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
      VALUES ('leads',NEW.id,'wijziging_gevoelig_veld','eigen_risico',OLD.eigen_risico::text,NEW.eigen_risico::text,_uid,_email,_role);
    END IF;
    IF NEW.exact_invoice_amount IS DISTINCT FROM OLD.exact_invoice_amount THEN
      INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
      VALUES ('leads',NEW.id,'wijziging_gevoelig_veld','exact_invoice_amount',OLD.exact_invoice_amount::text,NEW.exact_invoice_amount::text,_uid,_email,_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_lead_sensitive_changes ON public.leads;
CREATE TRIGGER trg_audit_lead_sensitive_changes
AFTER UPDATE OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.audit_lead_sensitive_changes();

-- Audit trigger voor policies
CREATE OR REPLACE FUNCTION public.audit_policy_sensitive_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE _uid uuid := auth.uid(); _email text; _role text;
BEGIN
  SELECT au.email INTO _email FROM auth.users au WHERE au.id=_uid;
  SELECT ur.role::text INTO _role FROM public.user_roles ur WHERE ur.user_id=_uid ORDER BY 1 LIMIT 1;

  IF TG_OP='DELETE' THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol,details)
    VALUES ('policies',OLD.id,'delete',NULL,to_jsonb(OLD)::text,NULL,_uid,_email,_role,jsonb_build_object('package_type',OLD.package_type));
    RETURN OLD;
  END IF;

  IF NEW.package_type IS DISTINCT FROM OLD.package_type THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','package_type',OLD.package_type::text,NEW.package_type::text,_uid,_email,_role);
  END IF;
  IF NEW.bav_per_event IS DISTINCT FROM OLD.bav_per_event THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','bav_per_event',OLD.bav_per_event::text,NEW.bav_per_event::text,_uid,_email,_role);
  END IF;
  IF NEW.bav_per_year IS DISTINCT FROM OLD.bav_per_year THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','bav_per_year',OLD.bav_per_year::text,NEW.bav_per_year::text,_uid,_email,_role);
  END IF;
  IF NEW.avb_per_event IS DISTINCT FROM OLD.avb_per_event THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','avb_per_event',OLD.avb_per_event::text,NEW.avb_per_event::text,_uid,_email,_role);
  END IF;
  IF NEW.avb_per_year IS DISTINCT FROM OLD.avb_per_year THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','avb_per_year',OLD.avb_per_year::text,NEW.avb_per_year::text,_uid,_email,_role);
  END IF;
  IF NEW.own_risk IS DISTINCT FROM OLD.own_risk THEN
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol)
    VALUES ('policies',NEW.id,'wijziging_gevoelig_veld','own_risk',OLD.own_risk::text,NEW.own_risk::text,_uid,_email,_role);
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_policy_sensitive_changes ON public.policies;
CREATE TRIGGER trg_audit_policy_sensitive_changes
AFTER UPDATE OR DELETE ON public.policies
FOR EACH ROW EXECUTE FUNCTION public.audit_policy_sensitive_changes();

-- Opruimen verificatie-artefacten
DROP FUNCTION IF EXISTS public.__role_guard_verification();
DROP FUNCTION IF EXISTS public.__delete_guard_verification();
DROP TABLE IF EXISTS public.__verify_results;
