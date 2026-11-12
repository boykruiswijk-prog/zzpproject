-- Besluit Boy 12-11-2026 12:29: tv-scherm opschonen. Alleen echte bedrijfsgebeurtenissen, weekomzet, groei per factureerbaar contract, mediaan afhandeltijd.
CREATE OR REPLACE FUNCTION public.scherm_echte_gebeurtenis(_actie text, _tekst text, _status text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $f$
  SELECT coalesce(_status, '') <> 'fout' AND CASE coalesce(_actie, '')
    WHEN 'lead_verzekering_aanvraag' THEN true
    WHEN 'certificaat' THEN true
    WHEN 'serviceverzoek' THEN true
    WHEN 'planner_run' THEN coalesce(_tekst, '') ~ '^Factuurplanner draaide: [1-9][0-9]* concepten'
    WHEN 'contract_status' THEN coalesce(_tekst, '') ~* '(opgezegd|beëindigd|beeindigd|geroyeerd)'
    ELSE false END
$f$;
REVOKE ALL ON FUNCTION public.scherm_echte_gebeurtenis(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_echte_gebeurtenis(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.scherm_factureerbaar_op(_d date)
 RETURNS TABLE(contract_id uuid, onderneming_id uuid, product text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT c.id, c.onderneming_id, c.product
  FROM public.klant_contracten c JOIN public.ondernemingen o ON o.id = c.onderneming_id
  WHERE NOT coalesce(c.is_test, false) AND NOT coalesce(o.is_test, false)
    AND c.status IN ('actief', 'loopt_af')
    AND c.begin_datum <= _d AND (c.eind_datum IS NULL OR c.eind_datum >= _d)
    AND coalesce(c.bedrag_per_periode, 0) > 0 AND coalesce(c.korting_pct, 0) < 100
    AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = c.cyber_lead_id AND l.status = 'gepauzeerd' AND coalesce(l.pauze_start_datum, _d) <= _d)
$f$;
REVOKE ALL ON FUNCTION public.scherm_factureerbaar_op(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_factureerbaar_op(date) TO service_role;

CREATE OR REPLACE FUNCTION public.scherm_groei()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE
  v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  v_vanaf date := date '2026-10-01';
  v_maandag date := date_trunc('week', (now() AT TIME ZONE 'Europe/Amsterdam')::date)::date;
  res jsonb;
BEGIN
  WITH nu AS (SELECT * FROM public.scherm_factureerbaar_op(v_vandaag)),
  kn AS (SELECT DISTINCT onderneming_id FROM nu),
  kb AS (SELECT DISTINCT onderneming_id FROM public.scherm_factureerbaar_op(v_vanaf - 1)),
  kw AS (SELECT DISTINCT onderneming_id FROM public.scherm_factureerbaar_op(v_maandag - 1))
  SELECT jsonb_build_object(
    'klanten', (SELECT count(*) FROM kn),
    'contracten', (SELECT count(*) FROM nu),
    'bav_avb', (SELECT count(*) FROM nu WHERE product IN ('bav_avb', 'nimble_bav')),
    'cyber', (SELECT count(*) FROM nu WHERE product = 'cyber_clear'),
    'lidmaatschap', (SELECT count(*) FROM nu WHERE product LIKE 'lidmaatschap%'),
    'overig', (SELECT count(*) FROM nu WHERE product NOT IN ('bav_avb', 'nimble_bav', 'cyber_clear') AND product NOT LIKE 'lidmaatschap%'),
    'sinds', jsonb_build_object('van', v_vanaf, 'begin', (SELECT count(*) FROM kb),
       'nieuw', (SELECT count(*) FROM (SELECT onderneming_id FROM kn EXCEPT SELECT onderneming_id FROM kb) x),
       'gestopt', (SELECT count(*) FROM (SELECT onderneming_id FROM kb EXCEPT SELECT onderneming_id FROM kn) x),
       'nu', (SELECT count(*) FROM kn)),
    'week', jsonb_build_object('van', v_maandag, 'begin', (SELECT count(*) FROM kw),
       'nieuw', (SELECT count(*) FROM (SELECT onderneming_id FROM kn EXCEPT SELECT onderneming_id FROM kw) x),
       'gestopt', (SELECT count(*) FROM (SELECT onderneming_id FROM kw EXCEPT SELECT onderneming_id FROM kn) x),
       'nu', (SELECT count(*) FROM kn))
  ) INTO res;
  RETURN res;
END $f$;
REVOKE ALL ON FUNCTION public.scherm_groei() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_groei() TO service_role;

CREATE OR REPLACE FUNCTION public.scherm_weekomzet_rijen()
 RETURNS TABLE(pakket text, tarief_type text, moment timestamptz, kanaal text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT coalesce(l.gekozen_pakket, b.pakket, '') AS pakket,
         coalesce(l.tarief_type, b.tarief_type, 'standaard') AS tarief_type,
         coalesce(l.created_at, b.aangemeld_op) AS moment,
         coalesce(l.extra_data->'attributie'->>'kanaal', '') AS kanaal
  FROM public.tel_aanvraag_cohort_tot(date '2026-10-06', (now() AT TIME ZONE 'Europe/Amsterdam')::date) c
  LEFT JOIN public.leads l ON l.id = c.sleutel
  LEFT JOIN LATERAL (SELECT b.pakket, b.tarief_type, b.aangemeld_op FROM public.bav_aanmeldingen b
                     WHERE b.lead_id = c.sleutel OR b.id = c.sleutel ORDER BY b.aangemeld_op LIMIT 1) b ON true
  WHERE c.dag >= date_trunc('week', (now() AT TIME ZONE 'Europe/Amsterdam')::date)::date - 7
$f$;
REVOKE ALL ON FUNCTION public.scherm_weekomzet_rijen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_weekomzet_rijen() TO service_role;
COMMENT ON FUNCTION public.scherm_dagomzet_rijen() IS 'DEPRECATED: vervangen door scherm_weekomzet_rijen (besluit Boy 12-11-2026)';

CREATE OR REPLACE FUNCTION public.scherm_werkstand()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  v_dagstart timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'werkstand', coalesce(jsonb_object_agg(s.station, jsonb_build_object(
      'lopend', lop.tekst IS NOT NULL,
      'lopende_tekst', coalesce(lop.tekst, laatst.tekst),
      'laatst_actief_op', coalesce(lop.gestart_op, laatst.moment),
      'laatste_status', laatst.status,
      'agent_bezig_sinds', CASE WHEN lop.is_agent THEN lop.gestart_op END,
      'duur_vandaag_min', coalesce(dur.minuten, 0))), '{}'::jsonb),
    'perioden', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'gestart_op', gestart_op, 'afgerond_op', afgerond_op, 'agent', is_agent))
       FROM (SELECT id, gestart_op, afgerond_op, is_agent FROM public.scherm_machine_live WHERE NOT is_test AND public.scherm_echte_gebeurtenis(actie, tekst, status) ORDER BY created_at DESC LIMIT 120) p), '[]'::jsonb),
    'activiteit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'station', station, 'actie', actie, 'tekst', tekst, 'status', status, 'tijd', created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM public.scherm_machine_live WHERE NOT is_test AND public.scherm_echte_gebeurtenis(actie, tekst, status) ORDER BY created_at DESC LIMIT 120) a), '[]'::jsonb),
    'nu_op_site', (SELECT count(*) FROM public.machine_activiteit WHERE actie = 'site_bezoek' AND NOT is_test AND created_at > now() - interval '5 minutes')
  ) INTO res
  FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)
  LEFT JOIN LATERAL (SELECT m.tekst, m.gestart_op, m.is_agent FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status = 'bezig' AND public.scherm_echte_gebeurtenis(m.actie, m.tekst, m.status) ORDER BY m.created_at DESC LIMIT 1) lop ON true
  LEFT JOIN LATERAL (SELECT m.tekst, m.status, coalesce(m.afgerond_op, m.created_at) AS moment FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status <> 'bezig' AND public.scherm_echte_gebeurtenis(m.actie, m.tekst, m.status) AND m.created_at > now() - interval '30 days'
     ORDER BY coalesce(m.afgerond_op, m.created_at) DESC LIMIT 1) laatst ON true
  LEFT JOIN LATERAL (SELECT round(sum(CASE WHEN m.gestart_op IS NULL THEN 1
          ELSE greatest(1, extract(epoch FROM least(coalesce(m.afgerond_op, now()), m.gestart_op + interval '30 minutes') - greatest(m.gestart_op, v_dagstart)) / 60) END))::int AS minuten
     FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND public.scherm_echte_gebeurtenis(m.actie, m.tekst, m.status) AND coalesce(m.afgerond_op, m.created_at) >= v_dagstart) dur ON true;
  RETURN res;
END $function$;

CREATE OR REPLACE FUNCTION public.scherm_schoon()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  WITH v AS (SELECT (now() AT TIME ZONE 'Europe/Amsterdam')::date AS vandaag),
  echt AS (SELECT m.* FROM public.scherm_machine_live m WHERE NOT m.is_test AND public.scherm_echte_gebeurtenis(m.actie, m.tekst, m.status) AND m.created_at > now() - interval '30 days')
  SELECT jsonb_build_object(
    'stations', (SELECT jsonb_object_agg(s.station, jsonb_build_object(
        'vandaag', (SELECT count(*) FROM echt e, v WHERE e.station = s.station AND (e.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v.vandaag),
        'skills', (SELECT count(DISTINCT e.actie) FROM echt e, v WHERE e.station = s.station AND (e.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v.vandaag),
        'laatste_status', (SELECT e.status FROM echt e WHERE e.station = s.station ORDER BY e.created_at DESC LIMIT 1)))
      FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)),
    'gebeurtenissen_vandaag', (SELECT count(*) FROM echt e, v WHERE (e.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v.vandaag),
    'intake_aanvragen', (SELECT jsonb_build_object(
        'vandaag', count(*) FILTER (WHERE (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = (SELECT vandaag FROM v)),
        'week', count(*), 'laatste', max(m.created_at))
      FROM public.scherm_machine_live m WHERE NOT m.is_test AND m.actie = 'lead_verzekering_aanvraag' AND m.created_at > now() - interval '7 days'),
    'service_afhandeltijd_uur', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (behandeld_op - created_at)) / 3600))::numeric, 1)
      FROM public.klant_service_aanvragen WHERE NOT coalesce(is_test, false) AND behandeld_op IS NOT NULL
        AND created_at > now() - interval '30 days' AND behandeld_op - created_at <= interval '14 days'),
    'scherm_groei', public.scherm_groei())
$f$;
REVOKE ALL ON FUNCTION public.scherm_schoon() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_schoon() TO service_role;