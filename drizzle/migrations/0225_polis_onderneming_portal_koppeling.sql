-- Polissen van klanten zonder online aanvraag (policies.onderneming_id, geen lead) hoorden nooit bij een Mijn ZP-account.
CREATE OR REPLACE FUNCTION public.portal_user_voor_onderneming(_onderneming_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(DISTINCT u.id) = 1 THEN (array_agg(DISTINCT u.id))[1] END
  FROM public.persoon_onderneming po
  JOIN public.personen p ON p.id = po.persoon_id AND coalesce(p.is_test, false) = false
  JOIN auth.users u ON lower(u.email) = lower(p.genormaliseerd_email) AND u.email_confirmed_at IS NOT NULL
  WHERE po.onderneming_id = _onderneming_id
$$;
REVOKE ALL ON FUNCTION public.portal_user_voor_onderneming(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_user_voor_onderneming(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.policies_onderneming_portal_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.lead_id IS NULL AND NEW.onderneming_id IS NOT NULL THEN
    NEW.user_id := public.portal_user_voor_onderneming(NEW.onderneming_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS policies_onderneming_portal_user ON public.policies;
CREATE TRIGGER policies_onderneming_portal_user BEFORE INSERT ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.policies_onderneming_portal_user();

-- Bestaande ongekoppelde klantpolissen: alleen als er precies één bevestigd account bij de onderneming hoort.
UPDATE public.policies p SET user_id = public.portal_user_voor_onderneming(p.onderneming_id)
WHERE p.user_id IS NULL AND p.lead_id IS NULL AND p.onderneming_id IS NOT NULL
  AND public.portal_user_voor_onderneming(p.onderneming_id) IS NOT NULL;