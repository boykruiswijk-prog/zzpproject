-- lovable-cron-fallback-reviewed: bounded billing queue, armed only for unfinished work and unscheduled after drain; three-minute batches finish within the same day
ALTER TABLE public.factuur_planner_runs ADD COLUMN IF NOT EXISTS bijgewerkt_op timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.factuur_planner_runs ADD COLUMN IF NOT EXISTS afgerond_op timestamptz;
CREATE OR REPLACE FUNCTION public.factuur_planner_start(_trigger text, _kandidaten integer, _geblokkeerd integer, _bedrag numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
 PERFORM pg_advisory_xact_lock(4401707, 429);
 IF EXISTS (SELECT 1 FROM public.factuur_planner_runs WHERE status='bezig' AND bijgewerkt_op > now()-interval '3 minutes') THEN RETURN NULL; END IF;
 UPDATE public.factuur_planner_runs SET status='onderbroken', afgerond_op=now(), detail=coalesce(detail,'{}'::jsonb)||jsonb_build_object('onderbroken',true) WHERE status='bezig';
 INSERT INTO public.factuur_planner_runs(modus,trigger_type,aantal_kandidaten,aantal_geblokkeerd,bedrag,status) VALUES ('live',_trigger,_kandidaten,_geblokkeerd,_bedrag,'bezig') RETURNING id INTO _id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_start(text,integer,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_planner_start(text,integer,integer,numeric) TO service_role;
CREATE OR REPLACE FUNCTION public.factuur_planner_vervolg(_actief boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _job bigint; _command text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF _actief THEN
  SELECT command INTO STRICT _command FROM cron.job WHERE jobname='factuur-planner-daily';
  _command := replace(_command, 'body := ''{}''::jsonb', 'body := ''{"vervolg":true}''::jsonb, timeout_milliseconds := 180000');
  PERFORM cron.schedule('factuur-planner-vervolg','*/3 * * * *', _command);
 ELSE
  SELECT jobid INTO _job FROM cron.job WHERE jobname='factuur-planner-vervolg';
  IF _job IS NOT NULL THEN PERFORM cron.unschedule(_job); END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_vervolg(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_planner_vervolg(boolean) TO service_role;