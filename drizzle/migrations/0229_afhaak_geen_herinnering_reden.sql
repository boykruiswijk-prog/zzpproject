DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aanvraag-nabellen-10min') THEN
    PERFORM cron.unschedule('aanvraag-nabellen-10min');
  END IF;
END $$;

-- Reden waarom een concept geen afhaakherinnering krijgt (null = verstuurd of nog in behandeling).
CREATE OR REPLACE FUNCTION public.afhaak_geen_herinnering_reden(_c public.aanvraag_concepten)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role) OR auth.role() = 'service_role') THEN NULL
    WHEN _c.herinnering_verstuurd_op IS NOT NULL THEN NULL
    WHEN coalesce(_c.is_test, false) OR lower(btrim(coalesce(_c.email,''))) LIKE '%@zpzaken.nl' THEN 'test'
    WHEN _c.spam_signaal = 'testinvoer' THEN 'testinvoer'
    WHEN _c.spam_signaal IN ('honeypot') THEN 'spam (honeypot)'
    WHEN _c.spam_signaal IS NOT NULL THEN 'spam of misbruikrem (' || _c.spam_signaal || ')'
    WHEN _c.lead_id IS NOT NULL OR _c.converted_at IS NOT NULL OR coalesce(_c.status,'open') IN ('omgezet','dubbel')
      OR EXISTS (SELECT 1 FROM public.leads l WHERE lower(btrim(l.email)) = lower(btrim(_c.email)) AND l.created_at >= _c.created_at) THEN 'al klant of aanvraag'
    WHEN coalesce(_c.max_stap, _c.stap, 0) < 2 THEN 'alleen stap 1'
    WHEN NOT (btrim(coalesce(_c.email,'')) ~ '^[^\s@<>(),;:"\[\]]+@[^\s@<>(),;:"\[\]]+\.[A-Za-z]{2,}$') THEN 'geen geldig e-mailadres'
    WHEN EXISTS (SELECT 1 FROM public.herinnering_afmeldingen a WHERE a.email = lower(btrim(_c.email))) THEN 'afgemeld'
    WHEN EXISTS (SELECT 1 FROM public.aanvraag_concepten c2 WHERE c2.id <> _c.id AND lower(btrim(c2.email)) = lower(btrim(_c.email)) AND c2.herinnering_verstuurd_op IS NOT NULL) THEN 'eerder al een herinnering op dit adres'
    WHEN _c.ip_hash IS NOT NULL AND EXISTS (SELECT 1 FROM public.aanvraag_concepten s WHERE s.ip_hash = _c.ip_hash AND s.spam_signaal IS NOT NULL) THEN 'misbruikrem'
    WHEN _c.laatst_actief_op < now() - interval '24 hours' THEN 'buiten herinneringstermijn'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION public.afhaak_geen_herinnering_reden(public.aanvraag_concepten) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.afhaak_geen_herinnering_reden(public.aanvraag_concepten) TO authenticated, service_role;