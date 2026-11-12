CREATE OR REPLACE FUNCTION public.scherm_stromen()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH cohort AS (
 SELECT l.id, l.kvk_gegevens, l.geactiveerd_op, l.status, l.converted_at, l.exact_invoice_id, l.exact_invoice_verwijderd_op, l.exact_credit_invoice_id_opzeg FROM public.leads l
 WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false)
 AND l.created_at >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
), ingediend AS (
 SELECT id FROM cohort UNION SELECT coalesce(b.lead_id,b.id) FROM public.bav_aanmeldingen b
 WHERE NOT coalesce(b.is_test,false) AND b.aangemeld_op >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
), gestart AS (
 SELECT id FROM ingediend UNION SELECT coalesce(c.lead_id,c.dubbel_lead_id,c.id) FROM public.aanvraag_concepten c
 WHERE NOT coalesce(c.is_test,false) AND c.created_at >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam'
 AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=coalesce(c.lead_id,c.dubbel_lead_id) AND coalesce(l.is_test,false))
), actief AS (
 -- Besluit Boy 12-11-2026 13:53: koppeling lead -> onderneming (polis, gekoppelde klant, afleiding zoals SPOED 2) -> BAV-contract.
 SELECT c.id, c.exact_invoice_id, c.exact_invoice_verwijderd_op, c.exact_credit_invoice_id_opzeg,
  coalesce((SELECT p.onderneming_id FROM public.policies p WHERE p.lead_id=c.id AND p.onderneming_id IS NOT NULL ORDER BY (p.status='geldig') DESC, p.created_at DESC LIMIT 1),
           (SELECT l.gekoppeld_onderneming_id FROM public.leads l WHERE l.id=c.id), public.policy_onderneming_afleiden(c.id)) ond,
  (SELECT min(p.start_date) FROM public.policies p WHERE p.lead_id=c.id AND p.status='geldig') start
 FROM cohort c WHERE c.geactiveerd_op IS NOT NULL OR c.status::text IN ('actief','klant')
), actief_k AS (
 SELECT a.*, coalesce((SELECT array_agg(kc.id) FROM public.klant_contracten kc WHERE kc.onderneming_id=a.ond AND kc.product='bav_avb' AND NOT coalesce(kc.is_test,false)), '{}'::uuid[]) contracten FROM actief a
), reis AS (
 SELECT a.*,
  ((a.exact_invoice_id IS NOT NULL AND a.exact_invoice_verwijderd_op IS NULL)
   OR EXISTS(SELECT 1 FROM public.factuur_planning f WHERE f.klant_contract_id = ANY(a.contracten) AND f.status NOT IN ('geannuleerd','fout','vervangen') AND NOT coalesce(f.is_test,false))) gefactureerd,
  (a.exact_credit_invoice_id_opzeg IS NOT NULL OR EXISTS(SELECT 1 FROM public.factuur_credit_planning cp WHERE cp.klant_contract_id = ANY(a.contracten)
   AND cp.bron IN ('planner','oud_systeem') AND cp.status IN ('verwerkt','concept_aangemaakt','handmatig_afgehandeld'))) gecrediteerd
 FROM actief_k a
), reis_s AS (
 SELECT r.*, CASE WHEN r.gefactureerd AND NOT r.gecrediteerd THEN 'klant'
   WHEN r.start > (now() AT TIME ZONE 'Europe/Amsterdam')::date THEN 'nog_niet_gestart'
   WHEN r.gecrediteerd THEN 'gecrediteerd' WHEN r.ond IS NULL THEN 'niet_gekoppeld' WHEN cardinality(r.contracten)=0 THEN 'geen_contract' ELSE 'geen_factuur' END stand
 FROM reis r
), minuten AS (
 SELECT station, floor(extract(epoch FROM (created_at AT TIME ZONE 'Europe/Amsterdam')::time)/60)::int minuut, count(*) n
 FROM public.scherm_machine_live WHERE NOT is_test AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date
 GROUP BY 1,2
), acties AS (
 SELECT station, actie, status, count(*) n FROM public.scherm_machine_live
 WHERE NOT is_test AND actie IS DISTINCT FROM 'cron' AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date=(now() AT TIME ZONE 'Europe/Amsterdam')::date GROUP BY 1,2,3
), ga AS (
 SELECT DISTINCT ON(dag) dag, data FROM public.marketing_snapshot WHERE bron='ga4' AND dag >= date '2026-10-06' ORDER BY dag,created_at DESC
)
SELECT jsonb_build_object(
 'stroom',jsonb_build_object('sinds','2026-10-06',
 'sessies',(SELECT sum(CASE WHEN coalesce(data->>'sessies',data->>'sessions') ~ '^[0-9]+$' THEN coalesce(data->>'sessies',data->>'sessions')::bigint ELSE NULL END) FROM ga),
 'gestart',(SELECT count(*) FROM gestart),'verstuurd',public.tel_aanvragen_doel(date '2026-10-06'),
 'kvk',(SELECT count(*) FROM cohort WHERE kvk_gegevens IS NOT NULL AND kvk_gegevens <> '{}'::jsonb),
 'actief',(SELECT count(*) FROM reis_s),
 'certificaat',(SELECT count(DISTINCT c.id) FROM cohort c JOIN public.policies p ON p.lead_id=c.id WHERE NOT coalesce(p.is_test,false) AND p.certificate_number IS NOT NULL),
 -- Besluit Boy 12-11-2026 13:53 (vervangt A7): klant = actief + factuur via lead (oude route) of factuurplanner op het contract, niet gecrediteerd bij opzegging.
 'klant',(SELECT count(*) FROM reis_s WHERE stand='klant'),
 'nog_niet_gestart',(SELECT count(*) FROM reis_s WHERE stand='nog_niet_gestart'),
 'nog_niet_gefactureerd',(SELECT count(*) FROM reis_s WHERE stand NOT IN ('klant','nog_niet_gestart')),
 'nog_niet_gefactureerd_reden',(SELECT coalesce(jsonb_object_agg(stand,n),'{}'::jsonb) FROM (SELECT stand,count(*) n FROM reis_s WHERE stand NOT IN ('klant','nog_niet_gestart') GROUP BY 1) x),
 -- Mediaan uren aanvraag tot polis actief, laatste 30 dagen (aanvragen sinds 6 oktober, geen test).
 'aanvraag_tot_polis_uur',(SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (l.geactiveerd_op-l.created_at))/3600))::numeric,1)
   FROM public.leads l WHERE l.type::text='verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND l.geactiveerd_op IS NOT NULL AND l.geactiveerd_op >= l.created_at
   AND l.created_at >= timestamp '2026-10-06 00:00:00' AT TIME ZONE 'Europe/Amsterdam' AND l.geactiveerd_op >= now() - interval '30 days')),
 'tijdlijn',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'minuut',minuut,'n',n) ORDER BY minuut) FROM minuten),'[]'::jsonb),
 'processen',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'actie',actie,'status',status,'n',n)) FROM acties),'[]'::jsonb))
$function$;