-- D7 (besluit Boy 15-10-2026): klant kan certificaat-PDF pas downloaden vanaf 1 kalendermaand voor de ingangsdatum.
-- Bestaande certificaten worden niet gewijzigd; alleen de leesregel voor klanten wordt strenger. Team blijft altijd lezen.
DROP POLICY IF EXISTS "Customers can view own certificates" ON storage.objects;
CREATE POLICY "Customers can view own certificates" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'certificates'
  AND EXISTS (
    SELECT 1 FROM public.policies p
     WHERE p.user_id = auth.uid() AND p.pdf_url IS NOT NULL AND p.pdf_url = objects.name
       AND (p.start_date IS NULL OR (p.start_date - interval '1 month')::date <= (now() AT TIME ZONE 'Europe/Amsterdam')::date)
  )
);