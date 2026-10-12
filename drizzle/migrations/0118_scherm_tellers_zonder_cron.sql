-- Live-scherm: stationtellers en processtappen tellen geen controlerondes (actie 'cron') meer als werk.
-- gebeurtenissen_vandaag (kop) blijft bewust cron-runs meetellen (eerder besluit).
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
 'actief',(SELECT count(*) FROM cohort WHERE geactiveerd_op IS NOT NULL OR status::text IN ('actief','klant')),
 'certificaat',(SELECT count(DISTINCT c.id) FROM cohort c JOIN public.policies p ON p.lead_id=c.id WHERE NOT coalesce(p.is_test,false) AND p.certificate_number IS NOT NULL),
 -- Register A7: klant = actief + Exact-factuur aanwezig, niet verwijderd en niet gecrediteerd bij opzegging.
 'klant',(SELECT count(*) FROM cohort WHERE (geactiveerd_op IS NOT NULL OR status::text IN ('actief','klant'))
   AND exact_invoice_id IS NOT NULL AND exact_invoice_verwijderd_op IS NULL AND exact_credit_invoice_id_opzeg IS NULL)),
 'tijdlijn',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'minuut',minuut,'n',n) ORDER BY minuut) FROM minuten),'[]'::jsonb),
 'processen',coalesce((SELECT jsonb_agg(jsonb_build_object('station',station,'actie',actie,'status',status,'n',n)) FROM acties),'[]'::jsonb))
$function$;

CREATE OR REPLACE FUNCTION public.scherm_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  v_start date := date '2026-10-06'; v_eind date := date '2026-12-31';
  res jsonb;
BEGIN
  WITH uniek AS (SELECT r.sleutel, r.dag FROM public.tel_aanvragen_doel_rijen(v_start) r),
  per_dag AS (SELECT d::date AS dag, (SELECT count(*) FROM uniek u WHERE u.dag = d::date) AS n FROM generate_series(v_start, least(v_vandaag, v_eind), interval '1 day') d),
  contr AS (SELECT * FROM public.klant_contracten WHERE NOT coalesce(is_test,false) AND (status = 'actief' OR (status = 'loopt_af' AND coalesce(eind_datum, v_vandaag) >= v_vandaag))),
  eerste AS (SELECT onderneming_id, min(begin_datum) AS start FROM public.klant_contracten WHERE NOT coalesce(is_test,false) AND onderneming_id IS NOT NULL GROUP BY onderneming_id),
  runs AS (SELECT d.status, d.start_time, j.jobname, j.active FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid WHERE d.start_time > now() - interval '7 days')
  SELECT jsonb_build_object(
    'gegenereerd_op', now(),
    'activiteit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'station', station, 'actie', actie, 'tekst', tekst, 'status', status, 'tijd', created_at) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.scherm_machine_live WHERE NOT is_test ORDER BY created_at DESC LIMIT 40) a), '[]'::jsonb),
    'stations', coalesce((SELECT jsonb_object_agg(station, jsonb_build_object('vandaag', vandaag, 'skills', skills, 'laatste_status', laatste_status)) FROM (
        SELECT s.station,
          (SELECT count(*) FROM public.scherm_machine_live m WHERE m.station = s.station AND NOT m.is_test AND m.actie IS DISTINCT FROM 'cron' AND (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag) AS vandaag,
          (SELECT count(DISTINCT coalesce(m.actie,'')) FROM public.scherm_machine_live m WHERE m.station = s.station AND NOT m.is_test AND m.actie IS DISTINCT FROM 'cron' AND (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag) AS skills,
          (SELECT m.status FROM public.scherm_machine_live m WHERE m.station = s.station AND NOT m.is_test ORDER BY m.created_at DESC LIMIT 1) AS laatste_status
        FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)) x), '{}'::jsonb),
    'gebeurtenissen_vandaag', (SELECT count(*) FROM public.scherm_machine_live WHERE NOT is_test AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag),
    'doel', jsonb_build_object(
      'doel', 200, 'start', v_start, 'eind', v_eind,
      'totaal', public.tel_aanvragen_doel(v_start),
      'vandaag', (SELECT count(*) FROM uniek WHERE dag = v_vandaag),
      'deze_week', (SELECT count(*) FROM uniek WHERE dag >= date_trunc('week', v_vandaag)::date),
      'per_dag', coalesce((SELECT jsonb_agg(jsonb_build_object('dag', dag, 'n', n) ORDER BY dag) FROM per_dag), '[]'::jsonb),
      'per_week', coalesce((SELECT jsonb_agg(jsonb_build_object('week', wk, 'n', n) ORDER BY wk) FROM (SELECT date_trunc('week', dag)::date wk, sum(n) n FROM per_dag GROUP BY 1) w), '[]'::jsonb),
      'resterende_dagen', greatest((v_eind - v_vandaag) + 1, 0),
      'tempo_14d', round(((SELECT count(*) FROM uniek WHERE dag > v_vandaag - 14)::numeric / least(14, greatest(v_vandaag - v_start + 1, 1))), 2)
    ),
    'klantbasis', jsonb_build_object(
      'actieve_klanten', public.tel_klanten(false),
      'actieve_contracten', public.tel_contracten(false),
      'certificaten_week', (SELECT count(*) FROM public.policies WHERE NOT coalesce(is_test,false) AND certificate_number IS NOT NULL AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam') + (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND coalesce(bron,'') NOT LIKE '%\_20261001' AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'certificaten_maand', (SELECT count(*) FROM public.policies WHERE NOT coalesce(is_test,false) AND certificate_number IS NOT NULL AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam') + (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND coalesce(bron,'') NOT LIKE '%\_20261001' AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'nieuw_per_maand', coalesce((SELECT jsonb_agg(jsonb_build_object('maand', to_char(m, 'YYYY-MM'), 'n', (SELECT count(*) FROM eerste e WHERE date_trunc('month', e.start) = m)) ORDER BY m)
          FROM generate_series(date_trunc('month', v_vandaag) - interval '11 months', date_trunc('month', v_vandaag), interval '1 month') m), '[]'::jsonb)
    ),
    'service', jsonb_build_object(
      'open', public.tel_service_open(false),
      'afhandeltijd_uur', (SELECT round(avg(extract(epoch FROM (behandeld_op - created_at)) / 3600)::numeric, 1) FROM public.klant_service_aanvragen
          WHERE NOT coalesce(is_test,false) AND behandeld_op IS NOT NULL AND created_at > now() - interval '30 days'),
      'bevestiging_5min_pct', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE ok) / count(*)) END FROM (
          SELECT EXISTS (SELECT 1 FROM public.lead_notification_log n WHERE n.lead_id = l.id AND n.status = 'sent' AND n.created_at <= l.created_at + interval '5 minutes') ok
          FROM public.leads l WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND l.created_at > now() - interval '30 days') q)
    ),
    'gezondheid', jsonb_build_object(
      'cron_ok_24u', (SELECT count(*) FROM runs WHERE start_time > now() - interval '24 hours' AND status = 'succeeded'),
      'cron_totaal_24u', (SELECT count(*) FROM runs WHERE start_time > now() - interval '24 hours' AND status IN ('succeeded','failed')),
      'cron_actief', (SELECT count(*) FROM cron.job WHERE active),
      'uptime_7d_pct', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE status = 'succeeded') / count(*), 1) END FROM runs WHERE status IN ('succeeded','failed')),
      'planner_ok', (SELECT status = 'ok' FROM public.factuur_planner_runs ORDER BY gestart_op DESC LIMIT 1),
      'planner_laatst', (SELECT gestart_op FROM public.factuur_planner_runs ORDER BY gestart_op DESC LIMIT 1),
      'exact_ok', (SELECT bool_or(coalesce(is_actief,false) AND refresh_token IS NOT NULL AND (coalesce(token_expires_at, now() + interval '1 day') > now() OR coalesce(refresh_token_obtained_at, now() - interval '60 days') > now() - interval '30 days')) FROM public.exact_config),
      'fouten_24u', (SELECT count(*) FROM public.scherm_machine_live WHERE NOT is_test AND status = 'fout' AND created_at > now() - interval '24 hours')
    ),
    'kennisbank', jsonb_build_object(
      'gepubliceerd', (SELECT count(*) FROM public.articles WHERE is_published),
      'nieuw_maand', (SELECT count(*) FROM public.articles WHERE is_published AND published_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'laatste', coalesce((SELECT jsonb_agg(title) FROM (SELECT title FROM public.articles WHERE is_published ORDER BY published_at DESC NULLS LAST LIMIT 3) t), '[]'::jsonb),
      'content_nieuw', (SELECT count(*) FROM public.articles WHERE is_published AND generated_by_ai AND published_at >= timestamptz '2026-10-06 00:00:00+02'),
      'content_verbeterd', (SELECT count(*) FROM public.articles WHERE is_published AND published_at < timestamptz '2026-10-06 00:00:00+02' AND updated_at >= timestamptz '2026-10-06 00:00:00+02')
    ),
    'marketing', coalesce((SELECT jsonb_object_agg(bron, jsonb_build_object('dag', dag, 'data', data)) FROM (
        SELECT DISTINCT ON (bron) bron, dag, data FROM public.marketing_snapshot ORDER BY bron, dag DESC) ms), '{}'::jsonb)
  ) INTO res;
  res := res || jsonb_build_object('workers', jsonb_build_object(
    'gepland', coalesce((SELECT jsonb_agg(jsonb_build_object('naam', naam, 'ritme', ritme, 'laatste', laatste, 'status', st) ORDER BY naam) FROM (
      SELECT coalesce(m.naam, initcap(left(replace(j.jobname, '-', ' '), 1)) || substr(replace(j.jobname, '-', ' '), 2)) AS naam,
        m.ritme, r.end_time AS laatste,
        CASE r.status WHEN 'succeeded' THEN 'klaar' WHEN 'failed' THEN 'fout' ELSE 'gepland' END AS st
      FROM cron.job j
      LEFT JOIN (VALUES
        ('aanvraag-concepten-anonimiseren','AVG-opschoning formulieren','elke nacht'),
        ('afgehaakt-samenvatting-dagelijks','Afgehaakte aanvragen opvolgen','elke ochtend'),
        ('exact-concept-controle-werkdagen','Exact-conceptcontrole','elk uur op werkdagen'),
        ('exact-keepalive-daily','Exact-koppeling bewaken','elke nacht'),
        ('factuur-planner-daily','Factuurplanner','elke ochtend'),
        ('polis-reminder-daily','Polisherinneringen','elke dag'),
        ('review-verzoeken-dagelijks','Reviewverzoeken','elke ochtend'),
        ('wijziging-mailen-vangnet','Wijzigingsmeldingen','elke 15 minuten'),
        ('zeker-chat-opschonen','Opschonen assistentgesprekken','elke nacht')) AS m(job, naam, ritme) ON m.job = j.jobname
      LEFT JOIN LATERAL (SELECT d.end_time, d.status FROM cron.job_run_details d WHERE d.jobid = j.jobid AND d.status IN ('succeeded','failed') ORDER BY d.start_time DESC LIMIT 1) r ON true
      WHERE j.active) g), '[]'::jsonb),
    'op_afroep', coalesce((SELECT jsonb_agg(jsonb_build_object('naam', naam, 'vandaag', vandaag, 'week', week, 'laatste', laatste, 'status', CASE WHEN laatste IS NULL THEN 'gepland' WHEN st = 'fout' THEN 'fout' ELSE 'klaar' END) ORDER BY nr) FROM (
      SELECT k.nr, k.naam,
        count(*) FILTER (WHERE (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag) AS vandaag,
        count(m.id) AS week,
        max(m.created_at) AS laatste,
        (array_agg(m.status ORDER BY m.created_at DESC) FILTER (WHERE m.id IS NOT NULL))[1] AS st
      FROM (VALUES (1,'Aanvraag-intake'),(2,'KVK-controle'),(3,'Certificaten'),(4,'Bevestigingsmails'),(5,'Zeker-assistent'),(6,'Klantservice'),(7,'Exact-synchronisatie')) AS k(nr, naam)
      LEFT JOIN public.scherm_machine_live m ON NOT m.is_test AND m.created_at > now() - interval '7 days' AND CASE k.nr
          WHEN 1 THEN m.station = 'intake' WHEN 2 THEN m.actie = 'kvk_check' WHEN 3 THEN m.station = 'certificaten'
          WHEN 4 THEN m.station = 'mail' AND m.actie = 'mail' WHEN 5 THEN m.station = 'assistent' AND m.actie = 'chat'
          WHEN 6 THEN m.station = 'service' WHEN 7 THEN m.actie = 'exact_sync' END
      GROUP BY k.nr, k.naam) o), '[]'::jsonb)
  ));
  RETURN res;
END $function$;
