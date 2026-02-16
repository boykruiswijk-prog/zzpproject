
-- Remove overly permissive storage policy (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can manage certificates" ON storage.objects;
