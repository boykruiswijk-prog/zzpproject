
-- Create a secure function for public verification that only returns safe fields
CREATE OR REPLACE FUNCTION public.verify_dba_certificate(_token text)
RETURNS TABLE(
  client_name text,
  certificate_number text,
  certified_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dc.client_name,
    dc.certificate_number,
    dc.certified_at,
    dc.status
  FROM public.dba_checks dc
  WHERE dc.verification_token = _token
    AND dc.status = 'certified'
  LIMIT 1;
$$;

-- Now remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can verify by token" ON public.dba_checks;
