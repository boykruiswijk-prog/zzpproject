CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END $$;
CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END $$;
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN RETURN FALSE;
END $$;
CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE new_id bigint;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_email(text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text,text,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
ALTER FUNCTION public.email_queue_dispatch() SET search_path = '';
ALTER FUNCTION public.email_queue_wake() SET search_path = '';
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT (auth.role()='service_role' OR coalesce(auth.jwt()->>'aal','')='aal2') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin'::public.app_role)
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT (auth.role()='service_role' OR coalesce(auth.jwt()->>'aal','')='aal2') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND (role=_role OR (_role='admin'::public.app_role AND role='supervisor'::public.app_role)))
$$;
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT (auth.role()='service_role' OR coalesce(auth.jwt()->>'aal','')='aal2') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('supervisor','admin'))
$$;
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT (auth.role()='service_role' OR coalesce(auth.jwt()->>'aal','')='aal2') AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_supervisor_or_admin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor_or_admin(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated,service_role;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname NOT IN ('verify_dba_certificate','log_not_found') LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',f.signature); END LOOP; END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER TABLE public.klant_service_aanvragen ADD COLUMN IF NOT EXISTS geverifieerd boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.audit_user_role_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.user_roles; v_actor uuid:=auth.uid(); v_email text;
BEGIN v_row:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; SELECT email INTO v_email FROM auth.users WHERE id=v_actor;
 INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol,details)
 VALUES('user_roles',v_row.id,lower(TG_OP),'role',CASE WHEN TG_OP IN('UPDATE','DELETE') THEN OLD.role::text END,CASE WHEN TG_OP IN('INSERT','UPDATE') THEN NEW.role::text END,v_actor,v_email,public.get_user_role_label(v_actor),jsonb_build_object('user_id',v_row.user_id));
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END $$;
REVOKE ALL ON FUNCTION public.audit_user_role_changes() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.audit_user_role_changes() TO service_role;
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();
CREATE OR REPLACE FUNCTION public.get_exact_config_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT CASE WHEN public.is_admin(auth.uid()) THEN coalesce((SELECT jsonb_build_object('id',id,'client_id_configured',client_id IS NOT NULL AND btrim(client_id)<>'','client_secret_configured',client_secret IS NOT NULL AND btrim(client_secret)<>'','token_configured',access_token IS NOT NULL AND refresh_token IS NOT NULL,'token_expires_at',token_expires_at,'divisie_code',divisie_code,'base_url',base_url,'is_actief',is_actief,'laatste_sync',laatste_sync,'updated_at',updated_at,'redirect_uri',redirect_uri,'access_token_expires_at',access_token_expires_at,'refresh_token_obtained_at',refresh_token_obtained_at,'last_sync_at',last_sync_at,'last_error',last_error) FROM public.exact_config LIMIT 1),'{}'::jsonb) ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.get_exact_config_status() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.get_exact_config_status() TO authenticated,service_role;
REVOKE SELECT ON public.exact_config FROM authenticated;
GRANT SELECT(id,client_id,token_expires_at,divisie_code,base_url,is_actief,laatste_sync,updated_at,redirect_uri,access_token_expires_at,refresh_token_obtained_at,last_sync_at,last_error,exact_item_id_bav_avb,exact_item_group_id,gl_code_bav,gl_account_id_bav,gl_account_id_bav_code,gl_code_screening,vat_code_screening,gl_account_id_screening,gl_account_id_screening_code,gl_account_ids) ON public.exact_config TO authenticated;
GRANT ALL ON public.exact_config TO service_role;
CREATE INDEX IF NOT EXISTS login_attempts_email_ip_created_idx ON public.login_attempts(lower(email),ip,created_at DESC);