-- Dagomzet: zelfde regels als tel_aanvraag_cohort, maar met variabele einddatum (geen vaste 31-12-2026). Aanvraagdoel ongewijzigd.
CREATE OR REPLACE FUNCTION public.tel_aanvraag_cohort_tot(_vanaf date, _tot date)
RETURNS TABLE(sleutel uuid, dag date, kvk text, statusgroep text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
 WITH bron AS (
 SELECT l.id,l.id lead_id,nullif(regexp_replace(coalesce(l.kvk_nummer,''),'[^0-9]','','g'),'') kvk,(l.created_at AT TIME ZONE 'Europe/Amsterdam')::date dag,l.status::text status FROM public.leads l WHERE l.type='verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN _vanaf AND _tot
 UNION ALL SELECT coalesce(b.lead_id,b.id),l.id,nullif(regexp_replace(coalesce(l.kvk_nummer,b.kvk_nummer,''),'[^0-9]','','g'),''),(b.aangemeld_op AT TIME ZONE 'Europe/Amsterdam')::date,coalesce(l.status::text,b.status) FROM public.bav_aanmeldingen b LEFT JOIN public.leads l ON l.id=b.lead_id WHERE NOT coalesce(b.is_test,false) AND NOT coalesce(l.is_test,false) AND (l.id IS NULL OR l.type='verzekering_aanvraag') AND (b.aangemeld_op AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN _vanaf AND _tot
 ), gegroepeerd AS (SELECT CASE WHEN kvk ~ '^[0-9]{8}$' THEN kvk ELSE id::text END groep,(array_agg(id ORDER BY (lead_id IS NULL),dag,id))[1] sleutel,min(dag) dag,max(kvk) kvk,bool_or(status='actief') actief,bool_or(status='in_behandeling') behandeling,bool_or(status IN ('nieuw','nieuw_te_beoordelen')) beoordeling FROM bron GROUP BY 1)
 SELECT g.sleutel,g.dag,g.kvk,CASE WHEN g.actief OR EXISTS(SELECT 1 FROM public.ondernemingen o JOIN public.klant_contracten c ON c.onderneming_id=public.onderneming_hoofdkaart(o.id) JOIN public.ondernemingen hoofd ON hoofd.id=c.onderneming_id WHERE o.kvk=g.kvk AND g.kvk ~ '^[0-9]{8}$' AND NOT coalesce(o.is_test,false) AND NOT coalesce(hoofd.is_test,false) AND c.product='bav_avb' AND c.status<>'vervangen' AND NOT coalesce(c.is_test,false)) THEN 'klant' WHEN g.behandeling THEN 'in_behandeling' WHEN g.beoordeling THEN 'te_beoordelen' ELSE 'overig' END FROM gegroepeerd g $function$;
REVOKE ALL ON FUNCTION public.tel_aanvraag_cohort_tot(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tel_aanvraag_cohort_tot(date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.scherm_dagomzet_rijen()
RETURNS TABLE(pakket text, tarief_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(l.gekozen_pakket, b.pakket, '') AS pakket,
         coalesce(l.tarief_type, b.tarief_type, 'standaard') AS tarief_type
  FROM public.tel_aanvraag_cohort_tot(date '2026-10-06', (now() AT TIME ZONE 'Europe/Amsterdam')::date) c
  LEFT JOIN public.leads l ON l.id = c.sleutel
  LEFT JOIN LATERAL (SELECT b.pakket, b.tarief_type FROM public.bav_aanmeldingen b
                     WHERE b.lead_id = c.sleutel OR b.id = c.sleutel ORDER BY b.aangemeld_op LIMIT 1) b ON true
  WHERE c.dag = (now() AT TIME ZONE 'Europe/Amsterdam')::date
$$;
REVOKE ALL ON FUNCTION public.scherm_dagomzet_rijen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_dagomzet_rijen() TO service_role;