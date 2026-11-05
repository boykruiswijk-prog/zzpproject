-- A8-aanvulling werktuin: schema per actieve geplande worker (zelfde naamgeving als scherm_data.workers.gepland), voor 'eerstvolgende runs'.
CREATE OR REPLACE FUNCTION public.scherm_cron_schema()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, cron AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('naam', naam, 'schema', schedule) ORDER BY naam), '[]'::jsonb) FROM (
    SELECT coalesce(m.naam, initcap(left(replace(j.jobname, '-', ' '), 1)) || substr(replace(j.jobname, '-', ' '), 2)) AS naam, j.schedule
    FROM cron.job j
    LEFT JOIN (VALUES
      ('aanvraag-concepten-anonimiseren','AVG-opschoning formulieren'),
      ('afgehaakt-samenvatting-dagelijks','Afgehaakte aanvragen opvolgen'),
      ('exact-concept-controle-werkdagen','Exact-conceptcontrole'),
      ('exact-keepalive-daily','Exact-koppeling bewaken'),
      ('factuur-planner-daily','Factuurplanner'),
      ('polis-reminder-daily','Polisherinneringen'),
      ('review-verzoeken-dagelijks','Reviewverzoeken'),
      ('wijziging-mailen-vangnet','Wijzigingsmeldingen'),
      ('zeker-chat-opschonen','Opschonen assistentgesprekken')) AS m(job, naam) ON m.job = j.jobname
    WHERE j.active) g;
$$;
REVOKE ALL ON FUNCTION public.scherm_cron_schema() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_cron_schema() TO service_role;