CREATE OR REPLACE FUNCTION public.scherm_stromen() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH cohort AS (
 SELECT l.id, l.kvk_gegevens, l.geactiveerd_op, l.status, l.converted_at FROM public.leads l
 WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false)
 AND l.created_at >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
), ingediend AS (
 SELECT id FROM cohort UNION SELECT coalesce(b.lead_id,b.id) FROM public.bav_aanmeldingen b
 WHERE NOT coalesce(b.is_test,false) AND b.aangemeld_op >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
), gestart AS (
 SELECT id FROM ingediend UNION SELECT coalesce(c.lead_id,c.dubbel_lead_id,c.id) FROM public.aanvraag_concepten c
 WHERE NOT coalesce(c.is_test,false) AND c.created_at >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
 AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=coalesce(c.lead_id,c.dubbel_lead_id) AND coalesce(l.is_test,false))
), minuten AS (
 SELECT station, floor(extract(epoch FROM (created_at AT TIME ZONE 'Europe/Amsterdam')::time)/60)::int minuut, count(*) n
 FROM public.machine_activiteit WHERE NOT is_test AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date
 GROUP BY 1,2
), acties AS (
 SELECT station, actie, status, count(*) n FROM public.machine_activiteit
 WHERE NOT is_test AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date GROUP BY 1,2,3
), ga AS (
 SELECT DISTINCT ON(dag) dag, data FROM public.marketing_snapshot WHERE bron='ga4' AND dag >= date '2026-10-06' ORDER BY dag,created_at DESC
)
SELECT jsonb_build_object(
 'stroom',jsonb_build_object('sinds','2026-10-06',
 'sessies',(SELECT sum(CASE WHEN coalesce(data->>'sessies',data->>'sessions') ~ '^[0-9]+$' THEN coalesce(data->>'sessies',data->>'sessions')::bigint ELSE NULL END) FROM ga),
 'gestart',(SELECT count(*) FROM gestart),'verstuurd',(SELECT count(*) FROM ingediend),
 'kvk',(SELECT count(*) FROM cohort WHERE kvk_gegevens IS NOT NULL AND kvk_gegevens <> '{}'::jsonb),
 'actief',(SELECT count(*) FROM cohort WHERE geactiveerd_op IS NOT NULL OR status::text IN ('actief','klant')),
 'certificaat',(SELECT count(DISTINCT c.id) FROM cohort c JOIN public.policies p ON p.lead_id=c.id WHERE NOT coalesce(p.is_test,false) AND p.certificate_number IS NOT NULL),
 'klant',(SELECT count(*) FROM cohort WHERE converted_at IS NOT NULL OR status::text='klant')),
 'tijdlijn',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'minuut',minuut,'n',n) ORDER BY minuut) FROM minuten),'[]'::jsonb),
 'processen',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'actie',actie,'status',status,'n',n)) FROM acties),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.scherm_stromen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_stromen() TO service_role;
COMMENT ON FUNCTION public.scherm_stromen() IS 'Visitor-safe counts for the Live screen, since 6 October; no identifying fields, excludes test cohorts.';