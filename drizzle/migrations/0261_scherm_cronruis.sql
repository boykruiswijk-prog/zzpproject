-- A8: only screen projection changes; queues, jobs, logs and mail behavior stay intact.
CREATE OR REPLACE VIEW public.scherm_machine_live AS
 SELECT m.id::text AS id, m.created_at, m.station, m.actie, m.tekst,
    CASE WHEN m.status = 'bezig' AND m.afgerond_op IS NULL AND COALESCE(m.gestart_op,m.created_at) < now()-interval '30 minutes' THEN 'onbekend' ELSE m.status END AS status,
    m.is_test,
    COALESCE(m.gestart_op,CASE WHEN m.status='bezig' THEN m.created_at ELSE NULL::timestamptz END) AS gestart_op,
    CASE WHEN m.status='bezig' AND m.afgerond_op IS NULL AND COALESCE(m.gestart_op,m.created_at)<now()-interval '30 minutes' THEN COALESCE(m.gestart_op,m.created_at)+interval '30 minutes' ELSE m.afgerond_op END AS afgerond_op,
    (COALESCE(m.bron,'') LIKE 'agent:%') AS is_agent
 FROM public.machine_activiteit m
 WHERE (m.actie IS DISTINCT FROM 'cron' OR m.status='fout')
   AND NOT (m.status='klaar' AND (m.bron='hartslag' OR m.tekst ~ '^Hartslag: alle [0-9]+ controles in orde$'))
   AND NOT (m.status='klaar' AND m.tekst ~ '^Opvolger: [0-9]+ open, 0 nieuw gesignaleerd, 0 tweede signaal$')
   AND NOT (m.status='klaar' AND m.actie IN ('mail','mail_verzonden') AND m.bron IN ('email_send_log','lead_notification_log'))
UNION ALL
 SELECT 'cron-'||d.runid::text, COALESCE(d.end_time,d.start_time), public.machine_cron_station(j.jobname), 'cron'::text,
    public.machine_cron_naam(j.jobname)||' (mislukt)', 'fout'::text, false, d.start_time,d.end_time,false
 FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid
 WHERE d.runid>(SELECT laatste_runid FROM public.machine_cron_stand WHERE id=1)
   AND d.status='failed' AND d.start_time>now()-interval '7 days'
UNION ALL
 SELECT 'mail-kwartier-'||extract(epoch FROM kwartier)::bigint::text, max(created_at), 'mail'::text, 'mail_verzonden'::text,
    count(*)::text||' mails verstuurd', 'klaar'::text, false, NULL::timestamptz,NULL::timestamptz,false
 FROM (
   SELECT DISTINCT ON (sleutel) sleutel,created_at,date_bin(interval '15 minutes',created_at,timestamptz '2000-01-01 00:00:00+00') AS kwartier
   FROM (
     SELECT COALESCE(NULLIF(message_id,''),'email:'||id::text) AS sleutel,created_at
     FROM public.email_send_log WHERE status='sent' AND created_at>now()-interval '7 days'
     UNION ALL
     SELECT COALESCE(NULLIF(resend_message_id,''),'lead:'||id::text),created_at
     FROM public.lead_notification_log WHERE status='sent' AND created_at>now()-interval '7 days'
   ) verzonden ORDER BY sleutel,created_at
 ) uniek GROUP BY kwartier;
REVOKE ALL ON public.scherm_machine_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.scherm_machine_live TO service_role;
COMMENT ON VIEW public.scherm_machine_live IS 'A8 screen-only projection: hide successful routine cron/heartbeat and empty follow-up rounds before feed limits; actual sent evidence deduplicated and summarized once per 15-minute bucket. All underlying jobs, logs, delivery and failure monitoring unchanged.';