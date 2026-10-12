ALTER TABLE public.machine_activiteit
  ADD COLUMN IF NOT EXISTS gestart_op timestamptz,
  ADD COLUMN IF NOT EXISTS afgerond_op timestamptz;

-- Nieuwe rijen: bezig krijgt een starttijd, afgeronde rijen een eindtijd. Mag een insert nooit laten falen.
CREATE OR REPLACE FUNCTION public.machine_activiteit_tijden() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'bezig' THEN NEW.gestart_op := coalesce(NEW.gestart_op, NEW.created_at, now());
    ELSE NEW.afgerond_op := coalesce(NEW.afgerond_op, NEW.created_at, now()); END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS machine_activiteit_tijden ON public.machine_activiteit;
CREATE TRIGGER machine_activiteit_tijden BEFORE INSERT ON public.machine_activiteit
  FOR EACH ROW EXECUTE FUNCTION public.machine_activiteit_tijden();

CREATE OR REPLACE FUNCTION public.machine_start(_station text, _actie text, _tekst text, _bron text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.machine_activiteit (station, actie, tekst, status, bron, gestart_op)
  VALUES (_station, _actie, left(coalesce(_tekst, ''), 90), 'bezig', _bron, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.machine_klaar(_id uuid, _status text, _tekst text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.machine_activiteit
     SET status = CASE WHEN _status = 'fout' THEN 'fout' ELSE 'klaar' END,
         tekst = coalesce(nullif(left(_tekst, 90), ''), tekst),
         afgerond_op = now()
   WHERE id = _id AND status = 'bezig' AND afgerond_op IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.machine_start(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_klaar(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.machine_start(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.machine_klaar(uuid, text, text) TO service_role;

-- View: een bezig-rij ouder dan 30 minuten telt als afgerond met status onbekend.
CREATE OR REPLACE VIEW public.scherm_machine_live AS
 SELECT (m.id)::text AS id, m.created_at, m.station, m.actie, m.tekst,
    CASE WHEN m.status = 'bezig' AND m.afgerond_op IS NULL AND coalesce(m.gestart_op, m.created_at) < now() - interval '30 minutes' THEN 'onbekend' ELSE m.status END AS status,
    m.is_test,
    coalesce(m.gestart_op, CASE WHEN m.status = 'bezig' THEN m.created_at END) AS gestart_op,
    CASE WHEN m.status = 'bezig' AND m.afgerond_op IS NULL AND coalesce(m.gestart_op, m.created_at) < now() - interval '30 minutes'
         THEN coalesce(m.gestart_op, m.created_at) + interval '30 minutes' ELSE m.afgerond_op END AS afgerond_op,
    coalesce(m.bron, '') LIKE 'agent:%' AS is_agent
   FROM public.machine_activiteit m
UNION ALL
 SELECT ('cron-'::text || (d.runid)::text), COALESCE(d.end_time, d.start_time),
    CASE WHEN j.jobname ~~ 'factuur%' THEN 'facturatie' WHEN j.jobname ~~ 'exact%' THEN 'exact'
         WHEN j.jobname ~~ 'review%' OR j.jobname ~~ 'polis%' OR j.jobname ~~ 'afgehaakt%' THEN 'mail'
         WHEN j.jobname ~~ 'zeker%' THEN 'assistent' ELSE 'kwaliteit' END,
    'cron', 'Geplande taak verwerkt',
    CASE WHEN d.status = 'failed' THEN 'fout' ELSE 'klaar' END,
    false, d.start_time, d.end_time, false
   FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.runid > (SELECT laatste_runid FROM public.machine_cron_stand WHERE id = 1)
    AND d.status = ANY (ARRAY['succeeded','failed']) AND d.start_time > now() - interval '7 days'
    AND NOT (j.jobname = 'wijziging-mailen-vangnet' AND d.status = 'succeeded');

-- Werkstand per station plus werkperiodes van de recente activiteit (zonder bron-id's).
CREATE OR REPLACE FUNCTION public.scherm_werkstand() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE
  v_dagstart timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'werkstand', coalesce(jsonb_object_agg(s.station, jsonb_build_object(
      'lopend', lop.tekst IS NOT NULL,
      'lopende_tekst', coalesce(lop.tekst, laatst.tekst),
      'laatst_actief_op', coalesce(lop.gestart_op, laatst.moment),
      'laatste_status', laatst.status,
      'duur_vandaag_min', coalesce(dur.minuten, 0))), '{}'::jsonb),
    'perioden', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'gestart_op', gestart_op, 'afgerond_op', afgerond_op, 'agent', is_agent))
       FROM (SELECT id, gestart_op, afgerond_op, is_agent FROM public.scherm_machine_live WHERE NOT is_test ORDER BY created_at DESC LIMIT 40) p), '[]'::jsonb)
  ) INTO res
  FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)
  LEFT JOIN LATERAL (SELECT m.tekst, m.gestart_op FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status = 'bezig' ORDER BY m.created_at DESC LIMIT 1) lop ON true
  LEFT JOIN LATERAL (SELECT m.tekst, m.status, coalesce(m.afgerond_op, m.created_at) AS moment FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status <> 'bezig' AND m.created_at > now() - interval '30 days'
     ORDER BY coalesce(m.afgerond_op, m.created_at) DESC LIMIT 1) laatst ON true
  LEFT JOIN LATERAL (SELECT round(sum(CASE WHEN m.gestart_op IS NULL THEN 1
          ELSE greatest(1, extract(epoch FROM least(coalesce(m.afgerond_op, now()), m.gestart_op + interval '30 minutes') - greatest(m.gestart_op, v_dagstart)) / 60) END))::int AS minuten
     FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND coalesce(m.afgerond_op, m.created_at) >= v_dagstart) dur ON true;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.scherm_werkstand() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_werkstand() TO service_role;