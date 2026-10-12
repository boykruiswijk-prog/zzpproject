-- Live-scherm: meer echte activiteit. Alleen AFTER-triggers via machine_log (slikt fouten in), vaste neutrale teksten, is_test overgeslagen.
CREATE INDEX IF NOT EXISTS machine_activiteit_actie_tijd ON public.machine_activiteit (actie, created_at DESC);

CREATE OR REPLACE FUNCTION public.machine_trg_extra()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  IF coalesce((j->>'is_test')::boolean, false) THEN RETURN NEW; END IF;
  CASE TG_TABLE_NAME
    WHEN 'aanvraag_concepten' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.machine_log('intake','formulier_start','Bezoeker start een aanvraag','klaar',TG_TABLE_NAME,false);
      ELSIF j->>'status' = 'omgezet' AND (o->>'status') IS DISTINCT FROM 'omgezet' THEN
        PERFORM public.machine_log('intake','formulier_af','Aanvraag afgerond en doorgezet','klaar',TG_TABLE_NAME,false);
      ELSIF (j->>'stap') IS DISTINCT FROM (o->>'stap') AND (j->>'stap') ~ '^[1-9]$' THEN
        PERFORM public.machine_log('intake','formulier_stap','Aanvraag gaat naar stap ' || (j->>'stap'),'klaar',TG_TABLE_NAME,false);
      END IF;
    WHEN 'chat_messages' THEN
      IF EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = (j->>'sessie_id')::uuid AND coalesce(s.is_test,false)) THEN RETURN NEW; END IF;
      PERFORM public.machine_log('assistent','chat_bericht',
        CASE WHEN j->>'rol' = 'assistant' THEN 'AI-assistent beantwoordt een vraag' ELSE 'Bezoeker stelt een vraag aan de AI-assistent' END,'klaar',TG_TABLE_NAME,false);
    WHEN 'indexnow_log' THEN
      PERFORM public.machine_log('kennisbank','indexnow','Pagina aangemeld bij Bing en andere zoekmachines',
        CASE WHEN j->>'ok' = 'false' THEN 'fout' ELSE 'klaar' END,TG_TABLE_NAME,false);
    WHEN 'klant_contracten' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.machine_log('acceptatie','contract_nieuw','Nieuwe polisregistratie aangemaakt','klaar',TG_TABLE_NAME,false);
      ELSIF (j->>'status') IS DISTINCT FROM (o->>'status') THEN
        PERFORM public.machine_log('facturatie','contract_status','Contractstatus bijgewerkt','klaar',TG_TABLE_NAME,false);
      END IF;
    WHEN 'portal_invitations' THEN
      PERFORM public.machine_log('service','portal_uitnodiging','Klant uitgenodigd voor Mijn ZP','klaar',TG_TABLE_NAME,false);
    WHEN 'form_rate_limit' THEN
      IF NOT EXISTS (SELECT 1 FROM public.machine_activiteit WHERE actie = 'spamfilter' AND created_at > now() - interval '60 seconds') THEN
        PERFORM public.machine_log('kwaliteit','spamfilter','Spamfilter controleert een formulier','klaar',TG_TABLE_NAME,false);
      END IF;
    WHEN 'email_send_log' THEN
      PERFORM public.machine_log('mail','mail_verzonden',
        CASE WHEN j->>'status' = 'failed' THEN 'Mail kon niet worden verzonden' ELSE 'Mail verzonden' END,
        CASE WHEN j->>'status' = 'failed' THEN 'fout' ELSE 'klaar' END,TG_TABLE_NAME,false);
    WHEN 'dba_checks' THEN
      PERFORM public.machine_log('acceptatie','dba_check','DBA-check uitgevoerd','klaar',TG_TABLE_NAME,false);
    WHEN 'screening_aanvragen' THEN
      PERFORM public.machine_log('acceptatie','screening','Screening aangevraagd','klaar',TG_TABLE_NAME,false);
    WHEN 'collective_signups' THEN
      PERFORM public.machine_log('intake','collectief','Aanmelding voor het collectief','klaar',TG_TABLE_NAME,false);
    ELSE NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.machine_trg_artikel_bijgewerkt()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t text;
BEGIN
  IF NOT (coalesce(OLD.is_published,false) AND coalesce(NEW.is_published,false)) THEN RETURN NEW; END IF;
  IF NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN RETURN NEW; END IF;
  t := 'Kennisbankartikel bijgewerkt: ' || CASE WHEN length(coalesce(NEW.title,'')) > 60 THEN left(NEW.title, 57) || '...' ELSE coalesce(NEW.title,'') END;
  IF EXISTS (SELECT 1 FROM public.machine_activiteit WHERE actie = 'artikel_verbeterd' AND tekst = left(t,90) AND created_at > now() - interval '10 minutes') THEN RETURN NEW; END IF;
  PERFORM public.machine_log('kennisbank','artikel_verbeterd',t,'klaar','articles',false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS machine_concept ON public.aanvraag_concepten;
CREATE TRIGGER machine_concept AFTER INSERT OR UPDATE OF stap, status ON public.aanvraag_concepten FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_chatbericht ON public.chat_messages;
CREATE TRIGGER machine_chatbericht AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_indexnow ON public.indexnow_log;
CREATE TRIGGER machine_indexnow AFTER INSERT ON public.indexnow_log FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_contract ON public.klant_contracten;
CREATE TRIGGER machine_contract AFTER INSERT OR UPDATE OF status ON public.klant_contracten FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_portal ON public.portal_invitations;
CREATE TRIGGER machine_portal AFTER INSERT ON public.portal_invitations FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_spam ON public.form_rate_limit;
CREATE TRIGGER machine_spam AFTER INSERT ON public.form_rate_limit FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_maillog ON public.email_send_log;
CREATE TRIGGER machine_maillog AFTER INSERT ON public.email_send_log FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_dba ON public.dba_checks;
CREATE TRIGGER machine_dba AFTER INSERT ON public.dba_checks FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_screening ON public.screening_aanvragen;
CREATE TRIGGER machine_screening AFTER INSERT ON public.screening_aanvragen FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_collectief ON public.collective_signups;
CREATE TRIGGER machine_collectief AFTER INSERT ON public.collective_signups FOR EACH ROW EXECUTE FUNCTION public.machine_trg_extra();
DROP TRIGGER IF EXISTS machine_artikel_bijgewerkt ON public.articles;
CREATE TRIGGER machine_artikel_bijgewerkt AFTER UPDATE OF content, updated_at ON public.articles FOR EACH ROW EXECUTE FUNCTION public.machine_trg_artikel_bijgewerkt();

REVOKE ALL ON FUNCTION public.machine_trg_extra() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.machine_trg_artikel_bijgewerkt() FROM PUBLIC, anon, authenticated;

-- Cron: elke run zichtbaar, vaste tekst en station per job.
CREATE OR REPLACE FUNCTION public.machine_cron_naam(_job text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _job LIKE 'factuur-planner%' THEN 'Facturatieplanner gecontroleerd'
    WHEN _job = 'exact-concept-controle-werkdagen' THEN 'Conceptfacturen in Exact gecontroleerd'
    WHEN _job LIKE 'exact%' THEN 'Exact-koppeling gesynchroniseerd'
    WHEN _job LIKE 'polis-reminder%' THEN 'Polisherinneringen gecontroleerd'
    WHEN _job LIKE 'review-verzoeken%' THEN 'Reviewverzoeken klaargezet'
    WHEN _job LIKE 'aanvraag-concepten%' THEN 'Oude formulierdata geanonimiseerd (AVG)'
    WHEN _job LIKE 'zeker%' THEN 'Oude assistentgesprekken opgeschoond'
    WHEN _job LIKE 'wijziging-mailen%' THEN 'Wijzigingsmeldingen gecontroleerd'
    WHEN _job LIKE 'afgehaakt%' THEN 'Overzicht afgehaakte aanvragen gemaakt'
    WHEN _job LIKE '%email%' OR _job LIKE '%mail-queue%' THEN 'Mailwachtrij verwerkt'
    WHEN _job LIKE '%image%' OR _job LIKE '%afbeelding%' THEN 'Afbeeldingen voor artikelen gecontroleerd'
    ELSE 'Geplande systeemtaak uitgevoerd' END
$function$;

CREATE OR REPLACE FUNCTION public.machine_cron_station(_job text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _job LIKE 'factuur%' THEN 'facturatie'
    WHEN _job LIKE 'exact%' THEN 'exact'
    WHEN _job LIKE 'review%' OR _job LIKE 'polis%' OR _job LIKE 'afgehaakt%' OR _job LIKE 'wijziging-mailen%' OR _job LIKE '%email%' OR _job LIKE '%mail-queue%' THEN 'mail'
    WHEN _job LIKE 'zeker%' THEN 'assistent'
    WHEN _job LIKE 'aanvraag-concepten%' THEN 'intake'
    WHEN _job LIKE '%image%' OR _job LIKE '%afbeelding%' OR _job LIKE 'indexnow%' OR _job LIKE 'kennisbank%' THEN 'kennisbank'
    ELSE 'kwaliteit' END
$function$;

CREATE OR REPLACE VIEW public.scherm_machine_live AS
 SELECT (m.id)::text AS id, m.created_at, m.station, m.actie, m.tekst,
    CASE WHEN m.status = 'bezig' AND m.afgerond_op IS NULL AND COALESCE(m.gestart_op, m.created_at) < now() - interval '30 minutes' THEN 'onbekend' ELSE m.status END AS status,
    m.is_test,
    COALESCE(m.gestart_op, CASE WHEN m.status = 'bezig' THEN m.created_at ELSE NULL::timestamptz END) AS gestart_op,
    CASE WHEN m.status = 'bezig' AND m.afgerond_op IS NULL AND COALESCE(m.gestart_op, m.created_at) < now() - interval '30 minutes' THEN COALESCE(m.gestart_op, m.created_at) + interval '30 minutes' ELSE m.afgerond_op END AS afgerond_op,
    (COALESCE(m.bron, '') LIKE 'agent:%') AS is_agent
   FROM public.machine_activiteit m
UNION ALL
 SELECT 'cron-' || d.runid::text AS id, COALESCE(d.end_time, d.start_time) AS created_at,
    public.machine_cron_station(j.jobname) AS station, 'cron'::text AS actie,
    public.machine_cron_naam(j.jobname) || CASE WHEN d.status = 'failed' THEN ' (mislukt)' ELSE '' END AS tekst,
    CASE WHEN d.status = 'failed' THEN 'fout' ELSE 'klaar' END AS status,
    false AS is_test, d.start_time AS gestart_op, d.end_time AS afgerond_op, false AS is_agent
   FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.runid > (SELECT laatste_runid FROM public.machine_cron_stand WHERE id = 1)
    AND d.status IN ('succeeded','failed') AND d.start_time > now() - interval '7 days';

CREATE OR REPLACE FUNCTION public.machine_cron_verwerken()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'cron'
AS $function$
DECLARE v_laatste bigint; v_max bigint; v_n int := 0; r record;
BEGIN
  SELECT laatste_runid INTO v_laatste FROM public.machine_cron_stand WHERE id = 1 FOR UPDATE;
  v_max := v_laatste;
  FOR r IN
    SELECT d.runid, d.status, coalesce(d.end_time, d.start_time) AS op, j.jobname
    FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.runid > v_laatste AND d.status IN ('succeeded','failed') AND d.start_time > now() - interval '7 days'
    ORDER BY d.runid LIMIT 500
  LOOP
    v_max := greatest(v_max, r.runid);
    PERFORM public.machine_log(public.machine_cron_station(r.jobname), 'cron',
      public.machine_cron_naam(r.jobname) || CASE WHEN r.status = 'failed' THEN ' (mislukt)' ELSE '' END,
      CASE WHEN r.status = 'failed' THEN 'fout' ELSE 'klaar' END, 'cron', false, r.op);
    v_n := v_n + 1;
  END LOOP;
  UPDATE public.machine_cron_stand SET laatste_runid = v_max, bijgewerkt_op = now() WHERE id = 1;
  RETURN v_n;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END $function$;

-- Anonieme sitebezoeken: alleen een vaste categorie, geen IP, cookies, sessie of user agent.
CREATE OR REPLACE FUNCTION public.site_bezoek(_categorie text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_station text; v_tekst text;
BEGIN
  SELECT x.s, x.t INTO v_station, v_tekst FROM (VALUES
    ('home','intake','Bezoeker bekijkt de homepage'),
    ('verzekeringen','intake','Bezoeker bekijkt de verzekeringen'),
    ('prijzen','intake','Bezoeker bekijkt de verzekeringen'),
    ('offerte','intake','Bezoeker opent het aanvraagformulier'),
    ('aanvragen','intake','Bezoeker opent het aanvraagformulier'),
    ('starters','intake','Starter bekijkt het starterspakket'),
    ('beroep','intake','Bezoeker bekijkt een beroepspagina'),
    ('kennisbank','kennisbank','Bezoeker leest een kennisbankartikel'),
    ('collectief','intake','Bezoeker bekijkt het collectief'),
    ('contact','service','Bezoeker bekijkt de contactpagina'),
    ('mijn_zp','service','Klant logt in op Mijn ZP')
  ) AS x(c, s, t) WHERE x.c = lower(left(coalesce(_categorie, ''), 30));
  IF v_station IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('site_bezoek'));
  IF EXISTS (SELECT 1 FROM public.machine_activiteit WHERE actie = 'site_bezoek' AND created_at > now() - interval '5 seconds') THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.machine_activiteit WHERE actie = 'site_bezoek' AND created_at > now() - interval '1 hour') >= 600 THEN RETURN; END IF;
  PERFORM public.machine_log(v_station, 'site_bezoek', v_tekst, 'klaar', 'site', false);
EXCEPTION WHEN OTHERS THEN RETURN;
END $function$;
REVOKE ALL ON FUNCTION public.site_bezoek(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_bezoek(text) TO anon, authenticated;

-- Werkstand: ruimere activiteit (groeperen gebeurt in scherm-data), nu op de site, lopende agenttimer.
CREATE OR REPLACE FUNCTION public.scherm_werkstand()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'cron'
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
       FROM (SELECT id, gestart_op, afgerond_op, is_agent FROM public.scherm_machine_live WHERE NOT is_test ORDER BY created_at DESC LIMIT 120) p), '[]'::jsonb),
    'activiteit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'station', station, 'actie', actie, 'tekst', tekst, 'status', status, 'tijd', created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM public.scherm_machine_live WHERE NOT is_test ORDER BY created_at DESC LIMIT 120) a), '[]'::jsonb),
    'nu_op_site', (SELECT count(*) FROM public.machine_activiteit WHERE actie = 'site_bezoek' AND NOT is_test AND created_at > now() - interval '5 minutes')
  ) INTO res
  FROM unnest(ARRAY['intake','acceptatie','certificaten','facturatie','exact','kennisbank','ads','kwaliteit','assistent','mail','service']) AS s(station)
  LEFT JOIN LATERAL (SELECT m.tekst, m.gestart_op, m.is_agent FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status = 'bezig' ORDER BY m.created_at DESC LIMIT 1) lop ON true
  LEFT JOIN LATERAL (SELECT m.tekst, m.status, coalesce(m.afgerond_op, m.created_at) AS moment FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND m.status <> 'bezig' AND m.created_at > now() - interval '30 days'
     ORDER BY coalesce(m.afgerond_op, m.created_at) DESC LIMIT 1) laatst ON true
  LEFT JOIN LATERAL (SELECT round(sum(CASE WHEN m.gestart_op IS NULL THEN 1
          ELSE greatest(1, extract(epoch FROM least(coalesce(m.afgerond_op, now()), m.gestart_op + interval '30 minutes') - greatest(m.gestart_op, v_dagstart)) / 60) END))::int AS minuten
     FROM public.scherm_machine_live m
     WHERE m.station = s.station AND NOT m.is_test AND coalesce(m.actie,'') <> 'site_bezoek' AND coalesce(m.afgerond_op, m.created_at) >= v_dagstart) dur ON true;
  RETURN res;
END $function$;