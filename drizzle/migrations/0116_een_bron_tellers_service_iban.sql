-- 1. Gedeelde telfuncties: enige definitie voor dashboard en scherm.
CREATE OR REPLACE FUNCTION public.tel_klanten(_toon_test boolean DEFAULT false) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT k.onderneming_id) FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
$$;
CREATE OR REPLACE FUNCTION public.tel_contracten(_toon_test boolean DEFAULT false) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
$$;
CREATE OR REPLACE FUNCTION public.tel_service_open(_toon_test boolean DEFAULT false) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.klant_service_aanvragen
   WHERE (_toon_test OR NOT is_test)
     AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')
     AND NOT (type = 'opzeggen' AND opzegging_verwerkt_op IS NOT NULL)
     AND type <> 'portaltoegang'
$$;
CREATE OR REPLACE FUNCTION public.tel_aanvragen_doel_rijen(_vanaf date DEFAULT date '2026-10-06')
RETURNS TABLE(sleutel uuid, dag date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sleutel, min(d) FROM (
    SELECT l.id AS sleutel, (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date AS d FROM public.leads l
     WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND l.created_at >= _vanaf::timestamp AT TIME ZONE 'Europe/Amsterdam'
    UNION
    SELECT coalesce(b.lead_id, b.id), (b.aangemeld_op AT TIME ZONE 'Europe/Amsterdam')::date FROM public.bav_aanmeldingen b
     WHERE NOT coalesce(b.is_test,false) AND b.aangemeld_op >= _vanaf::timestamp AT TIME ZONE 'Europe/Amsterdam'
  ) a GROUP BY sleutel
$$;
CREATE OR REPLACE FUNCTION public.tel_aanvragen_doel(_vanaf date DEFAULT date '2026-10-06') RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.tel_aanvragen_doel_rijen(_vanaf)
$$;
CREATE OR REPLACE FUNCTION public.tel_acties_vandaag(_toon_test boolean DEFAULT false) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((public.mijn_acties_vandaag(_toon_test)->>'totaal')::int, 0)
$$;
REVOKE ALL ON FUNCTION public.tel_klanten(boolean), public.tel_contracten(boolean), public.tel_service_open(boolean),
  public.tel_aanvragen_doel_rijen(date), public.tel_aanvragen_doel(date), public.tel_acties_vandaag(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tel_klanten(boolean), public.tel_contracten(boolean), public.tel_service_open(boolean),
  public.tel_aanvragen_doel_rijen(date), public.tel_aanvragen_doel(date), public.tel_acties_vandaag(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION pg_temp.vv(s text, a text, b text, regex boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  r := CASE WHEN regex THEN regexp_replace(s, a, b) ELSE replace(s, a, b) END;
  IF r = s THEN RAISE EXCEPTION 'vervanging niet gevonden: %', left(a, 80); END IF;
  RETURN r;
END $$;

DO $$
DECLARE d text; f text;
BEGIN
  -- dashboard_tellers
  d := pg_get_functiondef('public.dashboard_tellers(boolean)'::regprocedure);
  d := pg_temp.vv(d, '''klanten'', (SELECT count(DISTINCT onderneming_id) FROM k),', '''klanten'', public.tel_klanten(_toon_test),');
  d := pg_temp.vv(d, '''contracten_actief'', (SELECT count(*) FROM k),', '''contracten_actief'', public.tel_contracten(_toon_test),');
  d := pg_temp.vv(d, '''toon_test'', _toon_test', '''service_open'', public.tel_service_open(_toon_test), ''aanvragen_doel'', public.tel_aanvragen_doel(date ''2026-10-06''), ''aanvragen_doel_van'', 200, ''toon_test'', _toon_test');
  EXECUTE d;

  -- mijn_acties_vandaag: service-aantal uit tel_service_open
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  d := pg_temp.vv(d, $r$SELECT jsonb_build_object\('aantal', \(SELECT count\(\*\) FROM b\),(\s+)'per_type'$r$, $r$SELECT jsonb_build_object('aantal', public.tel_service_open(_toon_test),\1'per_type'$r$, true);
  EXECUTE d;

  -- scherm_data
  d := pg_get_functiondef('public.scherm_data()'::regprocedure);
  d := pg_temp.vv(d, $r$WITH aanvragen AS \(.*?GROUP BY sleutel\),$r$, 'WITH uniek AS (SELECT r.sleutel, r.dag FROM public.tel_aanvragen_doel_rijen(v_start) r),', true);
  d := pg_temp.vv(d, '''totaal'', (SELECT count(*) FROM uniek),', '''totaal'', public.tel_aanvragen_doel(v_start),');
  d := pg_temp.vv(d, '''actieve_klanten'', (SELECT count(DISTINCT onderneming_id) FROM contr)', '''actieve_klanten'', public.tel_klanten(false)');
  d := pg_temp.vv(d, '''actieve_contracten'', (SELECT count(*) FROM contr)', '''actieve_contracten'', public.tel_contracten(false)');
  d := pg_temp.vv(d, '''open'', (SELECT count(*) FROM public.klant_service_aanvragen WHERE NOT coalesce(is_test,false) AND status <> ''afgerond'')', '''open'', public.tel_service_open(false)');
  d := pg_temp.vv(d, '(''exact-concept-controle-werkdagen'',''Exact-conceptcontrole'',''werkdagen'')', '(''exact-concept-controle-werkdagen'',''Exact-conceptcontrole'',''elk uur op werkdagen'')');
  EXECUTE d;

  -- scherm_stromen
  d := pg_get_functiondef('public.scherm_stromen()'::regprocedure);
  d := pg_temp.vv(d, '''verstuurd'',(SELECT count(*) FROM ingediend)', '''verstuurd'',public.tel_aanvragen_doel(date ''2026-10-06'')');
  EXECUTE d;

  -- crm_gegevens_wijzigen: geen dubbele open exact_aanpassen-taak
  d := pg_get_functiondef('public.crm_gegevens_wijzigen(uuid,uuid,jsonb)'::regprocedure);
  d := pg_temp.vv(d, 'v_naam text; v_test boolean := false; mask text;', 'v_naam text; v_test boolean := false; mask text; v_bestaand uuid;');
  d := pg_temp.vv(d, $r$  IF array_length\(exact_velden,1\) > 0 THEN
    INSERT INTO public.crm_taken$r$, $r$  IF array_length(exact_velden,1) > 0 THEN
    SELECT t.id INTO v_bestaand FROM public.crm_taken t
     WHERE t.status = 'open' AND t.soort = 'exact_aanpassen' AND t.onderneming_id IS NOT DISTINCT FROM o.id
       AND coalesce(t.details->'velden','[]'::jsonb) @> to_jsonb(exact_velden)
     ORDER BY t.aangemaakt_op LIMIT 1;
  END IF;
  IF array_length(exact_velden,1) > 0 AND v_bestaand IS NOT NULL THEN
    UPDATE public.crm_taken SET details = coalesce(details,'{}'::jsonb) || jsonb_build_object('laatst_bijgewerkt_op', now(),
      'samengevoegd_aantal', coalesce((details->>'samengevoegd_aantal')::int, 0) + 1) WHERE id = v_bestaand;
  ELSIF array_length(exact_velden,1) > 0 THEN
    INSERT INTO public.crm_taken$r$, true);
  EXECUTE d;
END $$;

-- 2a. Serviceaanvragen bijwerken door het team via RPC (geen stille 0-rij-updates).
CREATE OR REPLACE FUNCTION public.service_aanvraag_status(_id uuid, _status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang'; END IF;
  IF _status NOT IN ('nieuw','in_behandeling','afgerond','behandeld','afgewezen','geannuleerd') THEN RAISE EXCEPTION 'onbekende status'; END IF;
  UPDATE public.klant_service_aanvragen SET status = _status, updated_at = now(),
    behandeld_op = CASE WHEN _status IN ('afgerond','behandeld','afgewezen','geannuleerd') THEN now() ELSE behandeld_op END,
    behandeld_door = auth.uid()
   WHERE id = _id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'aanvraag niet gevonden, niets bijgewerkt'; END IF;
  RETURN jsonb_build_object('bijgewerkt', n, 'status', _status);
END $$;
CREATE OR REPLACE FUNCTION public.service_aanvraag_afronden(_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.service_aanvraag_status(_id, 'afgerond') $$;
CREATE OR REPLACE FUNCTION public.service_aanvraag_notitie(_id uuid, _notitie text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(coalesce(_notitie,'')) > 5000 THEN RAISE EXCEPTION 'notitie te lang (max 5000 tekens)'; END IF;
  UPDATE public.klant_service_aanvragen SET notities = _notitie, updated_at = now() WHERE id = _id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'aanvraag niet gevonden, niets bijgewerkt'; END IF;
  RETURN jsonb_build_object('bijgewerkt', n);
END $$;
REVOKE ALL ON FUNCTION public.service_aanvraag_status(uuid,text), public.service_aanvraag_afronden(uuid), public.service_aanvraag_notitie(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_aanvraag_status(uuid,text), public.service_aanvraag_afronden(uuid), public.service_aanvraag_notitie(uuid,text) TO authenticated, service_role;

-- 3. IBAN intern inzien, elke inzage gelogd (zonder IBAN in het log).
CREATE OR REPLACE FUNCTION public.iban_inzien(_bron text, _id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; v_oud text; v_nieuw text; v_ond uuid; v_tabel text; t public.crm_taken;
BEGIN
  IF NOT ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang'; END IF;
  IF _bron = 'onderneming' THEN v_tabel := 'ondernemingen'; v_ond := _id; SELECT iban INTO v FROM public.ondernemingen WHERE id = _id;
  ELSIF _bron = 'mandaat' THEN v_tabel := 'klant_mandaat_v'; v_ond := _id;
    SELECT m.iban INTO v FROM public.ondernemingen o JOIN public.klant_mandaat_v m ON m.relatiecode = o.exact_relatie_code WHERE o.id = _id AND m.iban IS NOT NULL LIMIT 1;
  ELSIF _bron = 'lead' THEN v_tabel := 'leads'; SELECT iban INTO v FROM public.leads WHERE id = _id;
  ELSIF _bron = 'bav' THEN v_tabel := 'bav_aanmeldingen'; SELECT iban INTO v FROM public.bav_aanmeldingen WHERE id = _id;
  ELSIF _bron = 'sepa' THEN v_tabel := 'sepa_machtiging_bewijs'; SELECT iban INTO v FROM public.sepa_machtiging_bewijs WHERE id = _id;
  ELSIF _bron = 'screening' THEN v_tabel := 'screening_aanvragen'; SELECT iban INTO v FROM public.screening_aanvragen WHERE id = _id;
  ELSIF _bron = 'taak' THEN v_tabel := 'crm_taken';
    SELECT * INTO t FROM public.crm_taken WHERE id = _id;
    IF t.id IS NULL THEN RAISE EXCEPTION 'taak niet gevonden'; END IF;
    v_ond := t.onderneming_id;
    SELECT a.oude_waarde INTO v_oud FROM public.sensitive_audit_log a
     WHERE a.target_table = 'ondernemingen' AND a.target_id = t.onderneming_id AND a.veld = 'iban' AND a.actie = 'gegevens_gewijzigd'
       AND a.created_at >= t.aangemaakt_op - interval '1 minute' ORDER BY a.created_at LIMIT 1;
    SELECT iban INTO v_nieuw FROM public.ondernemingen WHERE id = t.onderneming_id;
    v := v_nieuw;
  ELSE RAISE EXCEPTION 'onbekende bron'; END IF;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
  VALUES (v_tabel, _id, 'iban_ingezien', 'iban', auth.uid(), auth.jwt()->>'email', public.get_user_role_label(auth.uid()),
    jsonb_build_object('bron', _bron, 'onderneming_id', v_ond, 'gevonden', v IS NOT NULL));
  RETURN jsonb_build_object('iban', v, 'oud', v_oud, 'nieuw', v_nieuw);
END $$;
REVOKE ALL ON FUNCTION public.iban_inzien(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iban_inzien(text, uuid) TO authenticated, service_role;

-- 2b. Exact-controle elk uur op werkdagen (de functie zelf beperkt tot 07:00-19:59 NL).
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'exact-concept-controle-werkdagen'), schedule := '15 5-18 * * 1-5');
