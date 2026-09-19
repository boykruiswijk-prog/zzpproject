-- Strikte eigenaarscheck op certificaten: exacte match op policies.pdf_url
-- (de opgeslagen bestandsnaam) in plaats van een LIKE/substring-vergelijking.
DROP POLICY IF EXISTS "Customers can view own certificates" ON storage.objects;

CREATE POLICY "Customers can view own certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.user_id = auth.uid()
      AND p.pdf_url IS NOT NULL
      AND p.pdf_url = storage.objects.name
  )
);