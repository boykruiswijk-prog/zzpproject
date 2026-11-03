-- lovable-cron-fallback-reviewed: tijdelijke vervolgtaak, alleen ingepland na echte voortgang en door de functie begrensd op 12 runs per dag; daarna uitgeschakeld tot de volgende dagrun
CREATE OR REPLACE FUNCTION public.factuur_planner_vervolg(_actief boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _job bigint; _command text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF _actief THEN
  SELECT command INTO STRICT _command FROM cron.job WHERE jobname='factuur-planner-daily';
  _command := replace(_command, 'body := ''{}''::jsonb', 'body := ''{"vervolg":true}''::jsonb, timeout_milliseconds := 180000');
  PERFORM cron.schedule('factuur-planner-vervolg','*/15 * * * *', _command);
 ELSE
  SELECT jobid INTO _job FROM cron.job WHERE jobname='factuur-planner-vervolg';
  IF _job IS NOT NULL THEN PERFORM cron.unschedule(_job); END IF;
 END IF;
END $function$;
REVOKE ALL ON FUNCTION public.factuur_planner_vervolg(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_planner_vervolg(boolean) TO service_role;