CREATE OR REPLACE FUNCTION public.arr_overzicht()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  vanaf date := date '2026-10-01';
  resultaat jsonb;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2'
     OR NOT (public.has_role(auth.uid(),'supervisor'::public.app_role) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Geen toegang tot ARR' USING ERRCODE = '42501';
  END IF;
  WITH contracten AS (
    SELECT c.*, (c.cyber_ingangsdatum IS NOT NULL OR coalesce(c.product,'') ILIKE '%cyber%') AS cyber
    FROM public.klant_contracten c WHERE c.is_test = false
  ), actief AS (
    SELECT * FROM contracten WHERE status = 'actief'
  ), gebeurtenissen AS (
    SELECT * FROM contracten WHERE status IN ('actief','loopt_af')
  ), maanden AS (
    SELECT m::date maand FROM generate_series(date_trunc('month',vandaag::timestamp)-interval '5 months',date_trunc('month',vandaag::timestamp),interval '1 month') m
  ), groei AS (
    SELECT m.maand,
      coalesce(sum(c.maandwaarde*12) FILTER (WHERE c.begin_datum >= m.maand AND c.begin_datum < (m.maand+interval '1 month') AND c.begin_datum <= vandaag),0) nieuw,
      coalesce(sum(c.maandwaarde*12) FILTER (WHERE c.eind_datum >= m.maand AND c.eind_datum < (m.maand+interval '1 month') AND c.eind_datum <= vandaag),0) aflopend
    FROM maanden m LEFT JOIN gebeurtenissen c ON (c.begin_datum >= m.maand AND c.begin_datum < m.maand+interval '1 month') OR (c.eind_datum >= m.maand AND c.eind_datum < m.maand+interval '1 month')
    GROUP BY m.maand
  ), cumulatief AS (
    SELECT coalesce(sum(maandwaarde*12) FILTER (WHERE begin_datum >= vanaf AND begin_datum <= vandaag),0) nieuw,
      coalesce(sum(maandwaarde*12) FILTER (WHERE eind_datum >= vanaf AND eind_datum <= vandaag),0) aflopend
    FROM gebeurtenissen
  )
  SELECT jsonb_build_object(
    'peildatum',vandaag,'vanaf',vanaf,
    'arr_totaal',round(coalesce(sum(a.maandwaarde),0)*12,2),
    'aantal_klanten',count(distinct a.onderneming_id),'aantal_contracten',count(a.id),
    'arr_loopt_af',(SELECT round(coalesce(sum(maandwaarde),0)*12,2) FROM contracten WHERE status='loopt_af'),
    'arr_cyber',round(coalesce(sum(a.maandwaarde) FILTER (WHERE a.cyber),0)*12,2),
    'aantal_contracten_cyber',count(a.id) FILTER (WHERE a.cyber),
    'aandeel_cyber_pct',coalesce(round(100*sum(a.maandwaarde) FILTER (WHERE a.cyber)/nullif(sum(a.maandwaarde),0),2),0),
    'gemiddelde_arr_per_klant',coalesce(round(sum(a.maandwaarde)*12/nullif(count(distinct a.onderneming_id),0),2),0),
    'arr_nieuw_sinds_1_okt',(SELECT round(nieuw,2) FROM cumulatief),
    'arr_aflopend_sinds_1_okt',(SELECT round(aflopend,2) FROM cumulatief),
    'netto_sinds_1_okt',(SELECT round(nieuw-aflopend,2) FROM cumulatief),
    'maanden',(SELECT jsonb_agg(jsonb_build_object('maand',maand,'nieuw',round(nieuw,2),'aflopend',round(aflopend,2),'netto',round(nieuw-aflopend,2)) ORDER BY maand) FROM groei)
  ) INTO resultaat FROM actief a;
  RETURN resultaat;
END;
$function$;
REVOKE ALL ON FUNCTION public.arr_overzicht() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.arr_overzicht() TO authenticated;
COMMENT ON FUNCTION public.arr_overzicht() IS 'A22 read-only ARR for MFA supervisor/admin only; active non-test monthly value annualized, separate expiry and cyber. Never included in screen payloads. Growth is start-date minus end-date flow at current stored values, not an historical price snapshot.';