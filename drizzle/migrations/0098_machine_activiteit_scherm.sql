-- ZP Zaken Live-scherm: publieke, geanonimiseerde activiteitenstroom
CREATE TABLE public.machine_activiteit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  station text NOT NULL CHECK (station IN ('intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service')),
  actie text NOT NULL,
  tekst text NOT NULL CHECK (char_length(tekst) <= 90),
  status text NOT NULL DEFAULT 'klaar' CHECK (status IN ('bezig','klaar','fout')),
  bron text,
  is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX machine_activiteit_created_idx ON public.machine_activiteit (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.machine_activiteit TO authenticated;
GRANT ALL ON public.machine_activiteit TO service_role;
ALTER TABLE public.machine_activiteit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor leest machine_activiteit" ON public.machine_activiteit FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor schrijft machine_activiteit" ON public.machine_activiteit FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor wijzigt machine_activiteit" ON public.machine_activiteit FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.marketing_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dag date NOT NULL,
  bron text NOT NULL CHECK (bron IN ('google_ads','microsoft_ads','search_console','ai_zichtbaarheid','ga4')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dag, bron)
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_snapshot TO authenticated;
GRANT ALL ON public.marketing_snapshot TO service_role;
ALTER TABLE public.marketing_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor leest marketing_snapshot" ON public.marketing_snapshot FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor schrijft marketing_snapshot" ON public.marketing_snapshot FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor wijzigt marketing_snapshot" ON public.marketing_snapshot FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

-- Laatst verwerkte cron-run (geen dubbele regels)
CREATE TABLE public.machine_cron_stand (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  laatste_runid bigint NOT NULL DEFAULT 0,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.machine_cron_stand TO service_role;
ALTER TABLE public.machine_cron_stand ENABLE ROW LEVEL SECURITY;
INSERT INTO public.machine_cron_stand (id, laatste_runid) VALUES (1, 0);

-- Provincie uit 4-cijferige postcode (nooit de plaats tonen)
CREATE OR REPLACE FUNCTION public.provincie_uit_postcode(_pc text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n int;
BEGIN
  n := nullif(substring(regexp_replace(coalesce(_pc,''), '\D', '', 'g') from 1 for 4), '')::int;
  IF n IS NULL OR n < 1000 THEN RETURN 'Nederland'; END IF;
  RETURN CASE
    WHEN n BETWEEN 1300 AND 1379 THEN 'Flevoland'
    WHEN n < 2200 THEN 'Noord-Holland'
    WHEN n < 3400 THEN 'Zuid-Holland'
    WHEN n < 3770 THEN 'Utrecht'
    WHEN n < 3890 THEN 'Gelderland'
    WHEN n < 3900 THEN 'Flevoland'
    WHEN n < 4000 THEN 'Utrecht'
    WHEN n < 4200 THEN 'Gelderland'
    WHEN n < 4300 THEN 'Zuid-Holland'
    WHEN n < 4600 THEN 'Zeeland'
    WHEN n < 5800 THEN 'Noord-Brabant'
    WHEN n < 6500 THEN 'Limburg'
    WHEN n < 7400 THEN 'Gelderland'
    WHEN n < 7800 THEN 'Overijssel'
    WHEN n < 8000 THEN 'Drenthe'
    WHEN n < 8200 THEN 'Overijssel'
    WHEN n < 8400 THEN 'Flevoland'
    WHEN n < 9300 THEN 'Friesland'
    WHEN n < 9500 THEN 'Drenthe'
    ELSE 'Groningen' END;
EXCEPTION WHEN OTHERS THEN RETURN 'Nederland';
END $$;

-- Beroep alleen als korte, schone omschrijving
CREATE OR REPLACE FUNCTION public.machine_beroep(_beroep text, _sector text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN coalesce(nullif(trim(_beroep),''), nullif(trim(_sector),'')) IS NULL THEN 'zzp''er'
    WHEN coalesce(nullif(trim(_beroep),''), trim(_sector)) ~ '[@0-9]' THEN 'zzp''er'
    ELSE lower(left(coalesce(nullif(trim(_beroep),''), trim(_sector)), 28)) END
$$;

CREATE OR REPLACE FUNCTION public.machine_log(_station text, _actie text, _tekst text, _status text, _bron text, _is_test boolean, _op timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron, is_test)
  VALUES (coalesce(_op, now()), _station, left(_actie, 40), left(_tekst, 90), coalesce(_status,'klaar'), _bron, coalesce(_is_test,false));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.machine_lead_tekst(_type text, _beroep text, _sector text, _postcode text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _type
    WHEN 'verzekering_aanvraag' THEN 'Nieuwe aanvraag BAV + AVB binnen, ' || public.machine_beroep(_beroep,_sector) || ' uit ' || public.provincie_uit_postcode(_postcode)
    WHEN 'offerte-aanvraag' THEN 'Offerteaanvraag binnen'
    ELSE 'Contactverzoek binnen' END
$$;

-- Triggers
CREATE OR REPLACE FUNCTION public.machine_trg_leads() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.is_test,false) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.machine_log(CASE WHEN NEW.type::text = 'contact' THEN 'service' ELSE 'intake' END,
      'lead_' || NEW.type::text, public.machine_lead_tekst(NEW.type::text, NEW.beroep, NULL, NEW.adres_postcode), 'klaar', 'leads', false);
  ELSIF NEW.status::text = 'actief' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.machine_log('acceptatie', 'lead_actief', 'Aanvraag geaccepteerd en polis actief', 'klaar', 'leads', false);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER machine_leads AFTER INSERT OR UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.machine_trg_leads();

CREATE OR REPLACE FUNCTION public.machine_trg_simpel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW); t boolean := coalesce((to_jsonb(NEW)->>'is_test')::boolean, false);
BEGIN
  IF t THEN RETURN NEW; END IF;
  CASE TG_TABLE_NAME
    WHEN 'bav_aanmeldingen' THEN
      PERFORM public.machine_log('intake','bav_aanmelding','BAV-aanmelding verwerkt, ' || public.machine_beroep(j->>'beroep', j->>'sector'),'klaar',TG_TABLE_NAME,false);
    WHEN 'klant_certificaten' THEN
      PERFORM public.machine_log('certificaten','certificaat','Certificaat aangemaakt voor opdrachtgever','klaar',TG_TABLE_NAME,false);
    WHEN 'factuur_planner_runs' THEN
      PERFORM public.machine_log('facturatie','planner_run',
        'Factuurplanner draaide: ' || coalesce(j->>'aantal_aangemaakt','0') || ' concepten, ' || coalesce(j->>'aantal_geblokkeerd','0') || ' geblokkeerd',
        CASE WHEN j->>'status' = 'ok' THEN 'klaar' WHEN j->>'status' IN ('bezig','gestart') THEN 'bezig' ELSE 'fout' END, TG_TABLE_NAME,false);
    WHEN 'exact_sync_log' THEN
      PERFORM public.machine_log('exact','exact_sync',
        CASE WHEN j->>'status' IN ('error','fout','failed') THEN 'Exact-synchronisatie mislukt, wordt opnieuw geprobeerd' ELSE 'Exact-synchronisatie gelukt' END,
        CASE WHEN j->>'status' IN ('error','fout','failed') THEN 'fout' ELSE 'klaar' END, TG_TABLE_NAME,false);
    WHEN 'lead_notification_log' THEN
      PERFORM public.machine_log('mail','mail',
        CASE WHEN j->>'status' = 'failed' THEN 'Bevestigingsmail mislukt' ELSE 'Bevestigingsmail verstuurd' END,
        CASE WHEN j->>'status' = 'failed' THEN 'fout' ELSE 'klaar' END, TG_TABLE_NAME,false);
    WHEN 'klant_service_aanvragen' THEN
      PERFORM public.machine_log('service','serviceverzoek','Serviceverzoek binnen: ' || replace(coalesce(j->>'type','overig'),'_',' '),'klaar',TG_TABLE_NAME,false);
    WHEN 'kvk_opvraag_log' THEN
      PERFORM public.machine_log('acceptatie','kvk_check','KVK-gegevens gecontroleerd','klaar',TG_TABLE_NAME,false);
    WHEN 'chat_sessions' THEN
      PERFORM public.machine_log('assistent','chat','Bezoeker stelt een vraag aan de Zeker-assistent','klaar',TG_TABLE_NAME,false);
    WHEN 'wijzigingsmeldingen' THEN
      PERFORM public.machine_log('kwaliteit','wijziging','Platform verbeterd: ' || coalesce(j->>'titel',''),'klaar',TG_TABLE_NAME,false);
    ELSE NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER machine_bav AFTER INSERT ON public.bav_aanmeldingen FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_cert AFTER INSERT ON public.klant_certificaten FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_planner AFTER INSERT ON public.factuur_planner_runs FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_exact AFTER INSERT ON public.exact_sync_log FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_mail AFTER INSERT ON public.lead_notification_log FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_service AFTER INSERT ON public.klant_service_aanvragen FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_kvk AFTER INSERT ON public.kvk_opvraag_log FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_chat AFTER INSERT ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();
CREATE TRIGGER machine_wijziging AFTER INSERT ON public.wijzigingsmeldingen FOR EACH ROW EXECUTE FUNCTION public.machine_trg_simpel();

CREATE OR REPLACE FUNCTION public.machine_trg_artikel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT coalesce(OLD.is_published,false)) THEN
    PERFORM public.machine_log('kennisbank','artikel_live','Nieuw kennisbankartikel live: ' || coalesce(NEW.title,''),'klaar','articles',false);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER machine_artikel AFTER INSERT OR UPDATE OF is_published ON public.articles FOR EACH ROW EXECUTE FUNCTION public.machine_trg_artikel();

CREATE OR REPLACE FUNCTION public.machine_trg_credit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.is_test,false) OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  PERFORM public.machine_log('facturatie','credit_status',
    '1 creditnota naar status: ' || replace(coalesce(NEW.status,''),'_',' '),
    CASE WHEN NEW.status = 'fout' THEN 'fout' WHEN NEW.status IN ('wacht_op_akkoord','te_maken') THEN 'bezig' ELSE 'klaar' END,
    'factuur_credit_planning', false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
CREATE TRIGGER machine_credit AFTER UPDATE OF status ON public.factuur_credit_planning FOR EACH ROW EXECUTE FUNCTION public.machine_trg_credit();

-- Cron-runs omzetten (aangeroepen door scherm-data)
CREATE OR REPLACE FUNCTION public.machine_cron_naam(_job text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _job
    WHEN 'factuur-planner-daily' THEN 'Facturatie-run uitgevoerd'
    WHEN 'exact-keepalive-daily' THEN 'Exact-koppeling gecontroleerd'
    WHEN 'polis-reminder-daily' THEN 'Polisherinneringen gecontroleerd'
    WHEN 'review-verzoeken-dagelijks' THEN 'Reviewverzoeken klaargezet'
    WHEN 'aanvraag-concepten-anonimiseren' THEN 'Oude formulierdata geanonimiseerd (AVG)'
    WHEN 'zeker-chat-opschonen' THEN 'Oude assistentgesprekken opgeschoond'
    WHEN 'exact-concept-controle-werkdagen' THEN 'Conceptfacturen in Exact gecontroleerd'
    WHEN 'wijziging-mailen-vangnet' THEN 'Wijzigingsmeldingen gecontroleerd'
    WHEN 'afgehaakt-samenvatting-dagelijks' THEN 'Overzicht afgehaakte aanvragen gemaakt'
    ELSE 'Geplande taak uitgevoerd' END
$$;

CREATE OR REPLACE FUNCTION public.machine_cron_verwerken() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE v_laatste bigint; v_max bigint; v_n int := 0; r record;
BEGIN
  SELECT laatste_runid INTO v_laatste FROM public.machine_cron_stand WHERE id = 1 FOR UPDATE;
  v_max := v_laatste;
  FOR r IN
    SELECT d.runid, d.status, coalesce(d.end_time, d.start_time) AS op, j.jobname
    FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.runid > v_laatste AND d.status IN ('succeeded','failed')
      AND d.start_time > now() - interval '7 days'
      AND j.jobname <> 'wijziging-mailen-vangnet'
    ORDER BY d.runid LIMIT 500
  LOOP
    PERFORM public.machine_log(
      CASE WHEN r.jobname LIKE 'factuur%' THEN 'facturatie' WHEN r.jobname LIKE 'exact%' THEN 'exact'
           WHEN r.jobname LIKE 'review%' OR r.jobname LIKE 'polis%' OR r.jobname LIKE 'afgehaakt%' THEN 'mail'
           WHEN r.jobname LIKE 'zeker%' THEN 'assistent' ELSE 'kwaliteit' END,
      'cron', public.machine_cron_naam(r.jobname) || CASE WHEN r.status = 'failed' THEN ' (mislukt)' ELSE '' END,
      CASE WHEN r.status = 'failed' THEN 'fout' ELSE 'klaar' END, 'cron', false, r.op);
    v_max := greatest(v_max, r.runid); v_n := v_n + 1;
  END LOOP;
  -- vangnet-runs wel als verwerkt markeren
  SELECT greatest(v_max, coalesce(max(d.runid), v_max)) INTO v_max FROM cron.job_run_details d
    WHERE d.runid > v_laatste AND d.status IN ('succeeded','failed') AND d.runid <= (SELECT coalesce(max(runid),0) FROM cron.job_run_details WHERE runid > v_laatste AND status IN ('succeeded','failed') AND runid <= v_max + 100000) AND v_n < 500;
  UPDATE public.machine_cron_stand SET laatste_runid = v_max, bijgewerkt_op = now() WHERE id = 1;
  RETURN v_n;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END $$;

-- Volledig geaggregeerde schermdata, zonder klantgegevens
CREATE OR REPLACE FUNCTION public.scherm_data() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE
  v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  v_start date := date '2026-10-06'; v_eind date := date '2026-12-31';
  res jsonb;
BEGIN
  WITH aanvragen AS (
    SELECT l.id AS sleutel, (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date AS dag FROM public.leads l
     WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND l.created_at >= v_start::timestamp AT TIME ZONE 'Europe/Amsterdam'
    UNION
    SELECT coalesce(b.lead_id, b.id), (b.aangemeld_op AT TIME ZONE 'Europe/Amsterdam')::date FROM public.bav_aanmeldingen b
     WHERE NOT coalesce(b.is_test,false) AND b.aangemeld_op >= v_start::timestamp AT TIME ZONE 'Europe/Amsterdam'
  ), uniek AS (SELECT sleutel, min(dag) AS dag FROM aanvragen GROUP BY sleutel),
  per_dag AS (SELECT d::date AS dag, (SELECT count(*) FROM uniek u WHERE u.dag = d::date) AS n FROM generate_series(v_start, least(v_vandaag, v_eind), interval '1 day') d),
  contr AS (SELECT * FROM public.klant_contracten WHERE NOT coalesce(is_test,false) AND (status = 'actief' OR (status = 'loopt_af' AND coalesce(eind_datum, v_vandaag) >= v_vandaag))),
  eerste AS (SELECT onderneming_id, min(begin_datum) AS start FROM public.klant_contracten WHERE NOT coalesce(is_test,false) AND onderneming_id IS NOT NULL GROUP BY onderneming_id),
  runs AS (SELECT d.status, d.start_time, j.jobname, j.active FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid WHERE d.start_time > now() - interval '7 days')
  SELECT jsonb_build_object(
    'gegenereerd_op', now(),
    'activiteit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'station', station, 'tekst', tekst, 'status', status, 'tijd', created_at) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.machine_activiteit WHERE NOT is_test ORDER BY created_at DESC LIMIT 40) a), '[]'::jsonb),
    'stations', coalesce((SELECT jsonb_object_agg(station, jsonb_build_object('vandaag', vandaag, 'laatste_status', laatste_status)) FROM (
        SELECT s.station,
          (SELECT count(*) FROM public.machine_activiteit m WHERE m.station = s.station AND NOT m.is_test AND (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag) AS vandaag,
          (SELECT m.status FROM public.machine_activiteit m WHERE m.station = s.station AND NOT m.is_test ORDER BY m.created_at DESC LIMIT 1) AS laatste_status
        FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)) x), '{}'::jsonb),
    'gebeurtenissen_vandaag', (SELECT count(*) FROM public.machine_activiteit WHERE NOT is_test AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag),
    'doel', jsonb_build_object(
      'doel', 200, 'start', v_start, 'eind', v_eind,
      'totaal', (SELECT count(*) FROM uniek),
      'vandaag', (SELECT count(*) FROM uniek WHERE dag = v_vandaag),
      'deze_week', (SELECT count(*) FROM uniek WHERE dag >= date_trunc('week', v_vandaag)::date),
      'per_dag', coalesce((SELECT jsonb_agg(jsonb_build_object('dag', dag, 'n', n) ORDER BY dag) FROM per_dag), '[]'::jsonb),
      'per_week', coalesce((SELECT jsonb_agg(jsonb_build_object('week', wk, 'n', n) ORDER BY wk) FROM (SELECT date_trunc('week', dag)::date wk, sum(n) n FROM per_dag GROUP BY 1) w), '[]'::jsonb),
      'resterende_dagen', greatest((v_eind - v_vandaag) + 1, 0),
      'tempo_14d', round(((SELECT count(*) FROM uniek WHERE dag > v_vandaag - 14)::numeric / least(14, greatest(v_vandaag - v_start + 1, 1))), 2)
    ),
    'klantbasis', jsonb_build_object(
      'actieve_klanten', (SELECT count(DISTINCT onderneming_id) FROM contr),
      'actieve_contracten', (SELECT count(*) FROM contr),
      'certificaten_week', (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'certificaten_maand', (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'nieuw_per_maand', coalesce((SELECT jsonb_agg(jsonb_build_object('maand', to_char(m, 'YYYY-MM'), 'n', (SELECT count(*) FROM eerste e WHERE date_trunc('month', e.start) = m)) ORDER BY m)
          FROM generate_series(date_trunc('month', v_vandaag) - interval '11 months', date_trunc('month', v_vandaag), interval '1 month') m), '[]'::jsonb)
    ),
    'service', jsonb_build_object(
      'open', (SELECT count(*) FROM public.klant_service_aanvragen WHERE NOT coalesce(is_test,false) AND status <> 'afgerond'),
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
      'fouten_24u', (SELECT count(*) FROM public.machine_activiteit WHERE NOT is_test AND status = 'fout' AND created_at > now() - interval '24 hours')
    ),
    'kennisbank', jsonb_build_object(
      'gepubliceerd', (SELECT count(*) FROM public.articles WHERE is_published),
      'nieuw_maand', (SELECT count(*) FROM public.articles WHERE is_published AND published_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),
      'laatste', coalesce((SELECT jsonb_agg(title) FROM (SELECT title FROM public.articles WHERE is_published ORDER BY published_at DESC NULLS LAST LIMIT 3) t), '[]'::jsonb)
    ),
    'marketing', coalesce((SELECT jsonb_object_agg(bron, jsonb_build_object('dag', dag, 'data', data)) FROM (
        SELECT DISTINCT ON (bron) bron, dag, data FROM public.marketing_snapshot ORDER BY bron, dag DESC) ms), '{}'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.scherm_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_cron_verwerken() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_log(text,text,text,text,text,boolean,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.machine_cron_verwerken() TO service_role;
GRANT EXECUTE ON FUNCTION public.machine_log(text,text,text,text,text,boolean,timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.machine_trg_leads() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_trg_simpel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_trg_artikel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_trg_credit() FROM PUBLIC, anon, authenticated;

-- Backfill laatste 7 dagen
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, CASE WHEN type::text = 'contact' THEN 'service' ELSE 'intake' END, 'lead_' || type::text,
  left(public.machine_lead_tekst(type::text, beroep, NULL, adres_postcode), 90), 'klaar', 'leads'
FROM public.leads WHERE NOT coalesce(is_test,false) AND created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT aangemeld_op, 'intake', 'bav_aanmelding', left('BAV-aanmelding verwerkt, ' || public.machine_beroep(beroep, sector), 90), 'klaar', 'bav_aanmeldingen'
FROM public.bav_aanmeldingen WHERE NOT coalesce(is_test,false) AND aangemeld_op > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'certificaten', 'certificaat', 'Certificaat aangemaakt voor opdrachtgever', 'klaar', 'klant_certificaten'
FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT published_at, 'kennisbank', 'artikel_live', left('Nieuw kennisbankartikel live: ' || title, 90), 'klaar', 'articles'
FROM public.articles WHERE is_published AND published_at > now() - interval '7 days' AND published_at <= now();
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT gestart_op, 'facturatie', 'planner_run', left('Factuurplanner draaide: ' || coalesce(aantal_aangemaakt,0) || ' concepten, ' || coalesce(aantal_geblokkeerd,0) || ' geblokkeerd', 90),
  CASE WHEN status = 'ok' THEN 'klaar' ELSE 'fout' END, 'factuur_planner_runs'
FROM public.factuur_planner_runs WHERE gestart_op > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'exact', 'exact_sync', CASE WHEN status IN ('error','fout','failed') THEN 'Exact-synchronisatie mislukt, wordt opnieuw geprobeerd' ELSE 'Exact-synchronisatie gelukt' END,
  CASE WHEN status IN ('error','fout','failed') THEN 'fout' ELSE 'klaar' END, 'exact_sync_log'
FROM public.exact_sync_log WHERE created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'mail', 'mail', CASE WHEN status = 'failed' THEN 'Bevestigingsmail mislukt' ELSE 'Bevestigingsmail verstuurd' END,
  CASE WHEN status = 'failed' THEN 'fout' ELSE 'klaar' END, 'lead_notification_log'
FROM public.lead_notification_log WHERE created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'service', 'serviceverzoek', left('Serviceverzoek binnen: ' || replace(coalesce(type,'overig'),'_',' '), 90), 'klaar', 'klant_service_aanvragen'
FROM public.klant_service_aanvragen WHERE NOT coalesce(is_test,false) AND created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'acceptatie', 'kvk_check', 'KVK-gegevens gecontroleerd', 'klaar', 'kvk_opvraag_log'
FROM public.kvk_opvraag_log WHERE created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'assistent', 'chat', 'Bezoeker stelt een vraag aan de Zeker-assistent', 'klaar', 'chat_sessions'
FROM public.chat_sessions WHERE NOT coalesce(is_test,false) AND created_at > now() - interval '7 days';
INSERT INTO public.machine_activiteit (created_at, station, actie, tekst, status, bron)
SELECT created_at, 'kwaliteit', 'wijziging', left('Platform verbeterd: ' || titel, 90), 'klaar', 'wijzigingsmeldingen'
FROM public.wijzigingsmeldingen WHERE created_at > now() - interval '7 days';
