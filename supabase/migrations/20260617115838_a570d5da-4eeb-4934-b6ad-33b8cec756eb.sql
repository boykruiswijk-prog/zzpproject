-- Add missing Data API GRANTs on public.leads
GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

-- Allow anon to SELECT the row they just inserted (needed for .select().single() after insert)
-- Limited to leads created in the last 1 minute to keep exposure minimal.
DROP POLICY IF EXISTS "Anonymous can read just-inserted lead" ON public.leads;
CREATE POLICY "Anonymous can read just-inserted lead"
ON public.leads
FOR SELECT
TO anon
USING (created_at > now() - interval '1 minute');