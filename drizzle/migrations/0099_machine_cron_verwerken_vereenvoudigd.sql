CREATE OR REPLACE FUNCTION public.machine_cron_verwerken() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE v_laatste bigint; v_max bigint; v_n int := 0; r record;
BEGIN
  SELECT laatste_runid INTO v_laatste FROM public.machine_cron_stand WHERE id = 1 FOR UPDATE;
  v_max := v_laatste;
  FOR r IN
    SELECT d.runid, d.status, coalesce(d.end_time, d.start_time) AS op, j.jobname
    FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.runid > v_laatste AND d.status IN ('succeeded','failed') AND d.start_time > now() - interval '7 days'
    ORDER BY d.runid LIMIT 500
  LOOP
    v_max := greatest(v_max, r.runid);
    CONTINUE WHEN r.jobname = 'wijziging-mailen-vangnet' AND r.status = 'succeeded';
    PERFORM public.machine_log(
      CASE WHEN r.jobname LIKE 'factuur%' THEN 'facturatie' WHEN r.jobname LIKE 'exact%' THEN 'exact'
           WHEN r.jobname LIKE 'review%' OR r.jobname LIKE 'polis%' OR r.jobname LIKE 'afgehaakt%' THEN 'mail'
           WHEN r.jobname LIKE 'zeker%' THEN 'assistent' ELSE 'kwaliteit' END,
      'cron', public.machine_cron_naam(r.jobname) || CASE WHEN r.status = 'failed' THEN ' (mislukt)' ELSE '' END,
      CASE WHEN r.status = 'failed' THEN 'fout' ELSE 'klaar' END, 'cron', false, r.op);
    v_n := v_n + 1;
  END LOOP;
  UPDATE public.machine_cron_stand SET laatste_runid = v_max, bijgewerkt_op = now() WHERE id = 1;
  RETURN v_n;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END $$;
REVOKE ALL ON FUNCTION public.machine_cron_verwerken() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.machine_cron_verwerken() TO service_role;
DO $$ DECLARE i int; BEGIN FOR i IN 1..20 LOOP EXIT WHEN public.machine_cron_verwerken() = 0; END LOOP; END $$;