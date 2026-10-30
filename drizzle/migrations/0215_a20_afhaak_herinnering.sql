-- A20-aanvulling 1: eenmalige herinneringsmail voor afgehaakte BAV + AVB-aanvragen.
-- Schakelaar: facturatie_config.herinnering_afhaak_vanaf (null = uit; alleen concepten vanaf dat moment).
ALTER TABLE public.facturatie_config ADD COLUMN IF NOT EXISTS herinnering_afhaak_vanaf timestamptz;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS herinnering_verstuurd_op timestamptz;
CREATE INDEX IF NOT EXISTS aanvraag_concepten_email_lower_idx ON public.aanvraag_concepten (lower(btrim(email)));
-- 'skipped' was al in gebruik voor overgeslagen klantbevestigingen; zonder deze waarde faalde die logregel.
ALTER TABLE public.lead_notification_log DROP CONSTRAINT IF EXISTS lead_notification_log_status_check;
ALTER TABLE public.lead_notification_log ADD CONSTRAINT lead_notification_log_status_check CHECK (status IN ('sent','failed','queued','skipped'));
-- FUNCTIES
CREATE OR REPLACE FUNCTION public.afhaak_herinnering_kandidaten(_nu timestamptz DEFAULT now(), _limit integer DEFAULT 25)
RETURNS TABLE(id uuid, email text, voornaam text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.email, k.voornaam FROM (
    SELECT DISTINCT ON (lower(btrim(c.email))) c.id, btrim(c.email) AS email, nullif(btrim(c.voornaam),'') AS voornaam, c.laatst_actief_op
    FROM public.aanvraag_concepten c
    CROSS JOIN (SELECT herinnering_afhaak_vanaf AS vanaf FROM public.facturatie_config WHERE id = 1) cfg
    WHERE cfg.vanaf IS NOT NULL
      AND c.created_at >= cfg.vanaf
      AND c.laatst_actief_op <= _nu - interval '2 hours'
      AND c.laatst_actief_op >= _nu - interval '24 hours'
      AND btrim(coalesce(c.email,'')) ~ '^[^\s@<>(),;:"\[\]]+@[^\s@<>(),;:"\[\]]+\.[A-Za-z]{2,}$'
      AND length(btrim(c.email)) <= 254
      AND NOT coalesce(c.is_test, false)
      AND c.geanonimiseerd_op IS NULL
      AND coalesce(c.status,'open') NOT IN ('omgezet','dubbel')
      AND c.lead_id IS NULL
      AND c.converted_at IS NULL
      AND c.herinnering_verstuurd_op IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE lower(btrim(l.email)) = lower(btrim(c.email)) AND l.created_at >= c.created_at)
      AND NOT EXISTS (SELECT 1 FROM public.aanvraag_concepten c2 WHERE lower(btrim(c2.email)) = lower(btrim(c.email)) AND c2.herinnering_verstuurd_op IS NOT NULL)
    ORDER BY lower(btrim(c.email)), c.laatst_actief_op DESC
  ) k ORDER BY k.laatst_actief_op LIMIT greatest(1, least(coalesce(_limit,25), 100));
$$;
REVOKE ALL ON FUNCTION public.afhaak_herinnering_kandidaten(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.afhaak_herinnering_kandidaten(timestamptz, integer) TO service_role;

-- Claim vóór verzending: per e-mailadres vergrendeld, zodat één adres nooit twee herinneringen krijgt.
CREATE OR REPLACE FUNCTION public.afhaak_herinnering_claim(_id uuid, _nu timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text;
BEGIN
  SELECT lower(btrim(email)) INTO e FROM public.aanvraag_concepten WHERE id = _id;
  IF e IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('afhaak_herinnering:' || e));
  IF NOT EXISTS (SELECT 1 FROM public.afhaak_herinnering_kandidaten(_nu, 100) k WHERE k.id = _id) THEN RETURN false; END IF;
  UPDATE public.aanvraag_concepten SET herinnering_verstuurd_op = _nu WHERE id = _id AND herinnering_verstuurd_op IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.afhaak_herinnering_claim(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.afhaak_herinnering_claim(uuid, timestamptz) TO service_role;

-- Per dag (NL-tijd): herinneringen verstuurd en hoeveel daarna een aanvraag afrondden. Alleen team met tweestapscode.
CREATE OR REPLACE FUNCTION public.afhaak_herinnering_per_dag()
RETURNS TABLE(dag date, verstuurd bigint, daarna_afgerond bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.a19_team();
  RETURN QUERY
  SELECT (g.created_at AT TIME ZONE 'Europe/Amsterdam')::date AS dag, count(*)::bigint,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.leads l WHERE lower(btrim(l.email)) = lower(btrim(g.recipient))
             AND l.type = 'verzekering_aanvraag' AND l.created_at > g.created_at AND NOT coalesce(l.is_test,false)))::bigint
  FROM public.lead_notification_log g
  WHERE g.lead_type = 'afhaak_herinnering' AND g.status = 'sent'
  GROUP BY 1 ORDER BY 1 DESC;
END $$;
REVOKE ALL ON FUNCTION public.afhaak_herinnering_per_dag() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.afhaak_herinnering_per_dag() TO authenticated;