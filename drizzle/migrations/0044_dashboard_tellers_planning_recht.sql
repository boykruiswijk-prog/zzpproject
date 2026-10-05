CREATE OR REPLACE FUNCTION public.dashboard_tellers(_toon_test boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; t_week timestamptz; t_maand timestamptz; vandaag date; p jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _toon_test AND NOT public.is_supervisor_or_admin(auth.uid()) THEN _toon_test := false; END IF;
  t_week := date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  t_maand := date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  vandaag := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  IF public.is_supervisor_or_admin(auth.uid()) THEN
    SELECT jsonb_build_object(
      'planning_aantal', count(*), 'planning_bedrag', round(coalesce(sum(bedrag),0),2),
      'planning_factureerbaar_aantal', count(*) FILTER (WHERE blokkade IS NULL),
      'planning_factureerbaar_bedrag', round(coalesce(sum(bedrag) FILTER (WHERE blokkade IS NULL),0),2),
      'planning_geblokkeerd_aantal', count(*) FILTER (WHERE blokkade IS NOT NULL),
      'planning_van', vandaag, 'planning_tot', vandaag + 29)
    INTO p FROM public.facturatie_kandidaten(vandaag, vandaag + 29);
  ELSE
    p := jsonb_build_object(
      'planning_aantal', NULL::bigint, 'planning_bedrag', NULL::numeric,
      'planning_factureerbaar_aantal', NULL::bigint, 'planning_factureerbaar_bedrag', NULL::numeric,
      'planning_geblokkeerd_aantal', NULL::bigint,
      'planning_van', NULL::date, 'planning_tot', NULL::date);
  END IF;
  WITH k AS (
    SELECT k.* FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
     WHERE k.status IN ('actief','loopt_af') AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
  ), l AS (SELECT * FROM public.leads WHERE _toon_test OR NOT is_test),
  oz AS (SELECT * FROM public.klant_service_aanvragen WHERE type = 'opzeggen' AND opzegging_verwerkt_op IS NULL AND (_toon_test OR NOT is_test)),
  m AS (SELECT round(coalesce(sum(CASE WHEN cyclus = 'jaar' THEN bedrag_per_periode*aantal/12 ELSE bedrag_per_periode*aantal END),0),2) v FROM k)
  SELECT jsonb_build_object(
    'klanten', (SELECT count(DISTINCT onderneming_id) FROM k),
    'contracten_actief', (SELECT count(*) FROM k),
    'mrr', (SELECT v FROM m),
    'arr', (SELECT round(v*12,2) FROM m),
    'leads_totaal', (SELECT count(*) FROM l),
    'leads_week', (SELECT count(*) FROM l WHERE created_at >= t_week),
    'leads_maand', (SELECT count(*) FROM l WHERE created_at >= t_maand),
    'leads_omgezet', (SELECT count(*) FROM l WHERE status IN ('actief','klant')),
    'opzeggingen_te_koppelen', (SELECT count(*) FROM oz WHERE coalesce(koppeling_status,'niet_gekoppeld') IN ('voorstel','niet_gekoppeld')),
    'opzeggingen_te_verwerken', (SELECT count(*) FROM oz WHERE koppeling_status = 'zeker'),
    'toon_test', _toon_test
  ) || p INTO r;
  RETURN r;
END $function$;
REVOKE ALL ON FUNCTION public.dashboard_tellers(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_tellers(boolean) TO authenticated, service_role;