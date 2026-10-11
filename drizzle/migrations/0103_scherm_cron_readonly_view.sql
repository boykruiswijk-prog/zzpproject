CREATE OR REPLACE VIEW public.scherm_machine_live WITH (security_barrier=true) AS
SELECT id::text AS id, created_at, station, actie, tekst, status, is_test FROM public.machine_activiteit
UNION ALL
SELECT 'cron-'||d.runid::text, coalesce(d.end_time,d.start_time),
 CASE WHEN j.jobname LIKE 'factuur%' THEN 'facturatie' WHEN j.jobname LIKE 'exact%' THEN 'exact' WHEN j.jobname LIKE 'review%' OR j.jobname LIKE 'polis%' OR j.jobname LIKE 'afgehaakt%' THEN 'mail' WHEN j.jobname LIKE 'zeker%' THEN 'assistent' ELSE 'kwaliteit' END,
 'cron', 'Geplande taak verwerkt', CASE WHEN d.status='failed' THEN 'fout' ELSE 'klaar' END, false
FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid
WHERE d.runid > (SELECT laatste_runid FROM public.machine_cron_stand WHERE id=1)
AND d.status IN ('succeeded','failed') AND d.start_time > now()-interval '7 days'
AND NOT(j.jobname='wijziging-mailen-vangnet' AND d.status='succeeded');
REVOKE ALL ON public.scherm_machine_live FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scherm_machine_live TO service_role;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.scherm_data()'::regprocedure); EXECUTE replace(d,'public.machine_activiteit','public.scherm_machine_live');
 d:=pg_get_functiondef('public.scherm_stromen()'::regprocedure); EXECUTE replace(d,'public.machine_activiteit','public.scherm_machine_live');
END $$;
COMMENT ON VIEW public.scherm_machine_live IS 'Read-only seven-day cron backfill, deduplicated against the last processed runid. No scheduled polling or visitor-triggered writes.';