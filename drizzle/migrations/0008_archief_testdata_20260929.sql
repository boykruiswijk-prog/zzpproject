CREATE SCHEMA IF NOT EXISTS archief;
REVOKE ALL ON SCHEMA archief FROM anon, authenticated;
GRANT USAGE ON SCHEMA archief TO service_role;
CREATE TABLE archief.leads_20260929 (LIKE public.leads);
CREATE TABLE archief.policies_20260929 (LIKE public.policies);
CREATE TABLE archief.monthly_invoices_log_20260929 (LIKE public.monthly_invoices_log);
CREATE TABLE archief.bav_aanmeldingen_20260929 (LIKE public.bav_aanmeldingen);
CREATE TABLE archief.portal_invitations_20260929 (LIKE public.portal_invitations);
CREATE TABLE archief.exact_sync_log_ontkoppeld_20260929 (LIKE public.exact_sync_log);
CREATE TABLE archief.activiteiten_log_ontkoppeld_20260929 (LIKE public.activiteiten_log);
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='archief' AND tablename LIKE '%20260929' LOOP
    EXECUTE format('ALTER TABLE archief.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON archief.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON archief.%I TO service_role', t);
  END LOOP;
END $$;