-- Correctie-creditnota's (bijv. verkeerde betaalwijze bij aanvraag) lopen via dezelfde creditroute, zonder opzegaanvraag.
ALTER TABLE public.factuur_credit_planning DROP CONSTRAINT factuur_credit_planning_bron_check;
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_bron_check CHECK (bron = ANY (ARRAY['planner','oud_systeem','correctie']));
ALTER TABLE public.factuur_credit_planning ALTER COLUMN aanvraag_id DROP NOT NULL;
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_aanvraag_of_correctie CHECK (aanvraag_id IS NOT NULL OR bron = 'correctie');

-- Herbeoordeling bij opzegging geldt niet voor correcties: hun gecrediteerde perioden staan vast.
CREATE OR REPLACE FUNCTION public.herbeoordeel_opzeg_credits()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  FOR r IN SELECT * FROM public.factuur_credit_planning WHERE status IN ('concept_niet_verwerkt','te_maken','geen_planner_factuur','geblokkeerd') AND bron <> 'correctie' LOOP
    PERFORM public.plan_opzeg_credit(r.klant_contract_id, r.aanvraag_id, r.einddatum); n := n + 1;
  END LOOP;
  RETURN n;
END $function$;