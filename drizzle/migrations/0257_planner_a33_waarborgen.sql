CREATE INDEX IF NOT EXISTS factuur_planner_live_dag_idx ON public.factuur_planner_runs (((gestart_op AT TIME ZONE 'Europe/Amsterdam')::date)) WHERE modus='live';
CREATE OR REPLACE FUNCTION public.factuur_planner_daggrens() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.modus <> 'live' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.modus='live' THEN
  IF NEW.gestart_op IS DISTINCT FROM OLD.gestart_op OR NEW.modus IS DISTINCT FROM OLD.modus THEN RAISE EXCEPTION 'Live runregistratie is onveranderbaar'; END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(4401707,429);
 NEW.gestart_op := now();
 IF (SELECT count(*) FROM public.factuur_planner_runs WHERE modus='live' AND (gestart_op AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date)>=5 THEN
  RAISE EXCEPTION 'A33: maximaal 5 echte factuurplannerruns per Nederlandse dag';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_daggrens() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER factuur_planner_daggrens BEFORE INSERT OR UPDATE OF modus,gestart_op ON public.factuur_planner_runs FOR EACH ROW EXECUTE FUNCTION public.factuur_planner_daggrens();
CREATE OR REPLACE FUNCTION public.factuur_planner_start(_trigger text,_kandidaten integer,_geblokkeerd integer,_bedrag numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
 PERFORM pg_advisory_xact_lock(4401707,429);
 IF (SELECT count(*) FROM public.factuur_planner_runs WHERE modus='live' AND (gestart_op AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date)>=5 THEN
  RAISE LOG 'A33 factuurplanner gestopt: daggrens 5 bereikt'; RETURN NULL;
 END IF;
 IF EXISTS (SELECT 1 FROM public.factuur_planner_runs WHERE status='bezig' AND bijgewerkt_op>now()-interval '3 minutes') THEN RETURN NULL; END IF;
 UPDATE public.factuur_planner_runs SET status='onderbroken',afgerond_op=now(),detail=coalesce(detail,'{}'::jsonb)||jsonb_build_object('onderbroken',true) WHERE status='bezig';
 INSERT INTO public.factuur_planner_runs(modus,trigger_type,aantal_kandidaten,aantal_geblokkeerd,bedrag,status) VALUES('live',_trigger,_kandidaten,_geblokkeerd,_bedrag,'bezig') RETURNING id INTO _id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.factuur_planner_start(text,integer,integer,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_planner_start(text,integer,integer,numeric) TO service_role;
CREATE TABLE public.eenmalige_besluiten(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),onderneming_id uuid NOT NULL,klant text NOT NULL,wat text NOT NULL,besluitdatum date NOT NULL,registerpunt text NOT NULL,bron text NOT NULL, vastgelegd_op timestamptz NOT NULL DEFAULT now(),UNIQUE(onderneming_id,registerpunt,bron));
GRANT SELECT ON public.eenmalige_besluiten TO authenticated;
GRANT ALL ON public.eenmalige_besluiten TO service_role;
ALTER TABLE public.eenmalige_besluiten ENABLE ROW LEVEL SECURITY;
CREATE POLICY eenmalige_besluiten_team ON public.eenmalige_besluiten FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()) AND (auth.jwt()->>'aal')='aal2');
COMMENT ON TABLE public.eenmalige_besluiten IS 'Registerverwijzingen voor eenmalige klantbesluiten; documentatie, geen nieuwe plannervoorwaarden.';