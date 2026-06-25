
-- Add user_id column for portal ownership
ALTER TABLE public.klant_service_aanvragen
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS klant_service_aanvragen_user_id_idx
  ON public.klant_service_aanvragen(user_id);

-- Klant kan eigen aanvraag indienen, strikt gekoppeld aan eigen polis
CREATE POLICY "Klant kan eigen serviceaanvraag indienen"
ON public.klant_service_aanvragen
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.certificate_number = klant_service_aanvragen.polisnummer
      AND p.user_id = auth.uid()
  )
);

-- Klant kan eigen aanvragen terugzien
CREATE POLICY "Klant kan eigen serviceaanvragen lezen"
ON public.klant_service_aanvragen
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());
