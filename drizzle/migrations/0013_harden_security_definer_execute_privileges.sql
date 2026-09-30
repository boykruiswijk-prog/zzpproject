REVOKE EXECUTE ON FUNCTION public.accept_portal_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_portal_invitation(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.audit_lead_sensitive_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_policy_sensitive_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_lead_sensitive_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_policy_sensitive_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.koppel_bronrecord_aan_persoon() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_binnengekomen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_sensitive_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_policy_sensitive_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_lead_sensitive_changes(), public.audit_policy_sensitive_changes(), public.guard_lead_sensitive_changes(), public.guard_policy_sensitive_changes(), public.handle_new_user(), public.koppel_bronrecord_aan_persoon(), public.log_lead_binnengekomen(), public.log_lead_sensitive_changes(), public.log_policy_sensitive_changes() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_exact_koppeling_fout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exact_koppeling_fout() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_mijn_polissen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mijn_polissen() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_portal_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_pilot_signup_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pilot_signup_count(text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.verify_dba_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_dba_certificate(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_role_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role_label(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor_or_admin(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.nextval_text(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nextval_text(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() TO service_role;
REVOKE EXECUTE ON FUNCTION public.portal_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_user_id_by_email(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;