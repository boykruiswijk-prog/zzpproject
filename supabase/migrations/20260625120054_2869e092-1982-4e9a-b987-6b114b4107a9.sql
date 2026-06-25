
CREATE POLICY "Customers can view own certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    -- pad begint met eigen user_id
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- of het bestand is gekoppeld aan een polis van deze klant
    EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.user_id = auth.uid()
        AND (p.pdf_url = storage.objects.name OR storage.objects.name LIKE '%' || p.pdf_url)
    )
  )
);
