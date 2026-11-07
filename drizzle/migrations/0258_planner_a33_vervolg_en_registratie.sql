-- lovable-cron-fallback-reviewed: existing bounded billing queue; quarter-hour checks only while pending, five real runs per NL day, unschedule after drain or cap; no permanent sweeper
CREATE OR REPLACE FUNCTION public.factuur_planner_daggrens() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.modus='live' THEN
  IF NEW.gestart_op IS DISTINCT FROM OLD.gestart_op OR NEW.modus IS DISTINCT FROM OLD.modus THEN RAISE EXCEPTION 'Live runregistratie is onveranderbaar'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.modus <> 'live' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(4401707,429);
 NEW.gestart_op := now();
 IF (SELECT count(*) FROM public.factuur_planner_runs WHERE modus='live' AND (gestart_op AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date)>=5 THEN RAISE EXCEPTION 'A33: maximaal 5 echte factuurplannerruns per Nederlandse dag'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_daggrens() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.factuur_planner_vervolg(_actief boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _job bigint; _command text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF _actief AND (SELECT count(*) FROM public.factuur_planner_runs WHERE modus='live' AND (gestart_op AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date)<5 THEN
  SELECT command INTO STRICT _command FROM cron.job WHERE jobname='factuur-planner-daily';
  _command := replace(_command, 'body := ''{}''::jsonb', 'body := ''{"vervolg":true}''::jsonb, timeout_milliseconds := 180000');
  PERFORM cron.schedule('factuur-planner-vervolg','*/15 * * * *', _command);
 ELSE
  SELECT jobid INTO _job FROM cron.job WHERE jobname='factuur-planner-vervolg';
  IF _job IS NOT NULL THEN PERFORM cron.unschedule(_job); END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_vervolg(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_planner_vervolg(boolean) TO service_role;