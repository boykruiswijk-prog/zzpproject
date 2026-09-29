CREATE OR REPLACE FUNCTION public.get_mijn_polissen()
RETURNS TABLE(
  id uuid,
  status public.lead_status,
  pauze_start_datum date,
  pauze_reden text,
  opzeg_datum date,
  exact_invoice_status smallint,
  functie_bij_aanvraag text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.id, l.status, l.pauze_start_datum, l.pauze_reden, l.opzeg_datum,
         l.exact_invoice_status, l.functie_bij_aanvraag
  FROM public.leads l
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.lead_id = l.id AND p.user_id = auth.uid()
    )
  ORDER BY l.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.get_mijn_polissen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mijn_polissen() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.portal_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_user_id_by_email(text) TO service_role;