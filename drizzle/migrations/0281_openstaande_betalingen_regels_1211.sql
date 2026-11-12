-- Openstaande betalingen (besluit Boy 12-11-2026 14:05).
ALTER TABLE public.incasso_mislukt
  ADD COLUMN IF NOT EXISTS administratie text CHECK (administratie IN ('exact','afas')),
  ADD COLUMN IF NOT EXISTS soort text CHECK (soort IN ('storno','naverrekening','overig')),
  ADD COLUMN IF NOT EXISTS bron_toelichting text,
  ADD COLUMN IF NOT EXISTS gemeld_door_naam text,
  ADD COLUMN IF NOT EXISTS cyclus_actief boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS betaald_notitie text,
  ADD COLUMN IF NOT EXISTS betaald_door uuid,
  ADD COLUMN IF NOT EXISTS laatste_contact_op timestamptz,
  ADD COLUMN IF NOT EXISTS exact_post_id text;
COMMENT ON COLUMN public.incasso_mislukt.cyclus_actief IS 'false = alleen in overzicht, geen klantherinneringen, geen opschorting, geen royementvoorstel';
ALTER TABLE public.incasso_mislukt DROP CONSTRAINT incasso_mislukt_bron_check;
ALTER TABLE public.incasso_mislukt ADD CONSTRAINT incasso_mislukt_bron_check CHECK (bron = ANY (ARRAY['handmatig','exact_detectie','exact_open_post']));

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.incasso_cyclus_stap(date)'::regprocedure);
  IF position('cyclus_actief' IN d) = 0 THEN
    d := replace(d, $r$WHERE m.status = 'open' LOOP$r$, $r$WHERE m.status = 'open' AND m.cyclus_actief LOOP$r$);
    IF position('cyclus_actief' IN d) = 0 THEN RAISE EXCEPTION 'incasso_cyclus_stap niet aangepast'; END IF;
    EXECUTE d;
  END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.onderneming_bij_exact_account(_account_id text, _code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT min(id::text)::uuid FROM ondernemingen WHERE exact_account_id = _account_id AND samengevoegd_naar IS NULL
      HAVING count(*) = 1),
    (SELECT min(id::text)::uuid FROM ondernemingen WHERE nullif(trim(_code),'') IS NOT NULL AND trim(exact_relatie_code) = trim(_code) AND samengevoegd_naar IS NULL
      HAVING count(*) = 1))
$$;

CREATE OR REPLACE FUNCTION public.onderneming_betaalachterstand(_onderneming_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _onderneming_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM incasso_mislukt m WHERE m.onderneming_id = _onderneming_id AND m.status IN ('open','royement_voorgesteld'))
    OR EXISTS (SELECT 1 FROM exact_open_posten_cache p
      WHERE p.sync_run_id = public.finance_open_run()
        AND p.vervaldatum < (now() AT TIME ZONE 'Europe/Amsterdam')::date - 14
        AND coalesce(p.bedrag,0) > 0
        AND public.onderneming_bij_exact_account(p.account_id, p.account_code) = _onderneming_id))
$$;

CREATE OR REPLACE FUNCTION public.review_kandidaten(_limit integer DEFAULT 50)
 RETURNS TABLE(lead_id uuid, email text, voornaam text, geactiveerd_op timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT l.id, l.email, l.voornaam, l.geactiveerd_op
  FROM public.leads l
  WHERE l.type = 'verzekering_aanvraag'
    AND coalesce(l.is_test, false) = false
    AND l.created_at >= '2026-10-06'
    AND l.geactiveerd_op IS NOT NULL
    AND l.geactiveerd_op <= now() - interval '2 days'
    AND l.geactiveerd_op >= now() - interval '30 days'
    AND l.status NOT IN ('opgezegd','gepauzeerd')
    AND coalesce(trim(l.email), '') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_verzoeken r WHERE r.lead_id = l.id)
    AND NOT public.onderneming_betaalachterstand(coalesce(l.gekoppeld_onderneming_id, public.policy_onderneming_afleiden(l.id)))
  ORDER BY l.geactiveerd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$function$;

CREATE OR REPLACE FUNCTION public.review_herinnering_kandidaten(_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, lead_id uuid, email text, voornaam text, token text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.lead_id, r.email, coalesce(l.voornaam, d.voornaam), r.token
  FROM public.review_verzoeken r
  LEFT JOIN public.leads l ON l.id = r.lead_id
  LEFT JOIN public.review_bestaand_doelgroep d ON d.id = r.doelgroep_id
  WHERE r.status = 'verstuurd'
    AND r.verstuurd_op <= now() - interval '7 days'
    AND r.geklikt_op IS NULL AND r.herinnering_op IS NULL
    AND (l.id IS NOT NULL OR d.id IS NOT NULL)
    AND (l.id IS NULL OR (l.status <> 'opgezegd' AND coalesce(l.is_test, false) = false))
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(r.email))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(r.email)))
    AND NOT public.onderneming_betaalachterstand(coalesce(d.onderneming_id, l.gekoppeld_onderneming_id, CASE WHEN l.id IS NOT NULL THEN public.policy_onderneming_afleiden(l.id) END))
  ORDER BY r.verstuurd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$function$;

CREATE OR REPLACE FUNCTION public.incasso_open_posten_sync()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid; v_run_tijd timestamptz; v_nieuw int := 0; v_betaald int := 0; v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR current_user IN ('postgres','supabase_admin')) THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  v_run := public.finance_open_run();
  SELECT gestart_op INTO v_run_tijd FROM exact_finance_runs WHERE id = v_run;
  IF v_run IS NULL OR v_run_tijd < now() - interval '2 days' THEN
    RETURN jsonb_build_object('overgeslagen', 'geen verse volledige open-postenrun');
  END IF;
  WITH k AS (
    SELECT DISTINCT ON (p.factuurnummer) p.*, public.onderneming_bij_exact_account(p.account_id, p.account_code) AS ond
    FROM exact_open_posten_cache p
    WHERE p.sync_run_id = v_run AND coalesce(p.bedrag,0) > 0 AND p.factuurnummer IS NOT NULL
      AND p.vervaldatum < v_vandaag - 14
      AND EXISTS (SELECT 1 FROM exact_betalingen_cache b WHERE b.factuurnummer = p.factuurnummer AND b.is_terugboeking)
    ORDER BY p.factuurnummer, p.opgehaald_op DESC
  ), ins AS (
    INSERT INTO incasso_mislukt (onderneming_id, factuurnummer, bedrag, mislukt_op, bron, reden, administratie, soort, bron_toelichting, cyclus_actief, exact_post_id, is_test)
    SELECT k.ond, k.factuurnummer, k.bedrag, k.vervaldatum, 'exact_open_post', 'Storno, meer dan 14 dagen over vervaldatum', 'exact', 'storno', 'automatisch uit Exact open posten', false, k.exact_id, o.is_test
    FROM k JOIN ondernemingen o ON o.id = k.ond
    WHERE NOT EXISTS (SELECT 1 FROM incasso_mislukt m WHERE m.onderneming_id = k.ond AND m.factuurnummer = k.factuurnummer AND m.status IN ('open','royement_voorgesteld'))
    RETURNING 1
  ) SELECT count(*) INTO v_nieuw FROM ins;
  WITH upd AS (
    UPDATE incasso_mislukt m SET status = 'betaald', betaald_op = v_vandaag, betaald_notitie = 'Niet meer in de open posten van Exact'
    WHERE m.administratie = 'exact' AND m.status = 'open'
      AND NOT EXISTS (SELECT 1 FROM exact_open_posten_cache p WHERE p.sync_run_id = v_run AND p.factuurnummer = m.factuurnummer AND coalesce(p.bedrag,0) > 0)
    RETURNING m.id
  ), aud AS (
    INSERT INTO sensitive_audit_log (target_table, target_id, actie, details)
    SELECT 'incasso_mislukt', id, 'incasso_betaald_exact', jsonb_build_object('run', v_run, 'betaald_op', v_vandaag) FROM upd RETURNING 1
  ) SELECT count(*) INTO v_betaald FROM aud;
  RETURN jsonb_build_object('run', v_run, 'nieuw', v_nieuw, 'betaald', v_betaald);
END $$;

CREATE OR REPLACE FUNCTION public.incasso_handmatig_betaald(_id uuid, _notitie text, _datum date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i incasso_mislukt; v_n text := btrim(coalesce(_notitie,'')); v_d date := coalesce(_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date);
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  IF length(v_n) < 3 OR length(v_n) > 500 THEN RAISE EXCEPTION 'notitie verplicht (3 tot 500 tekens)'; END IF;
  SELECT * INTO i FROM incasso_mislukt WHERE id = _id FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'niet gevonden'; END IF;
  IF i.status NOT IN ('open','royement_voorgesteld') THEN RAISE EXCEPTION 'status is al %', i.status; END IF;
  UPDATE incasso_mislukt SET status = 'betaald', betaald_op = v_d, betaald_notitie = v_n, betaald_door = auth.uid() WHERE id = _id;
  INSERT INTO sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, details)
  VALUES ('incasso_mislukt', _id, 'incasso_betaald', auth.uid(), jsonb_build_object('betaald_op', v_d, 'notitie', v_n, 'administratie', i.administratie));
  PERFORM public.crm_notitie_toevoegen(i.onderneming_id, NULL, 'notitie',
    'Factuur ' || i.factuurnummer || ' op betaald gezet: ' || v_n, jsonb_build_object('incasso_id', _id, 'soort', 'incasso_betaald'));
  RETURN jsonb_build_object('id', _id, 'status', 'betaald');
END $$;

CREATE OR REPLACE FUNCTION public.incasso_contact_gelegd(_id uuid, _wijze text, _notitie text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i incasso_mislukt; v_notitie uuid; v_n text := nullif(btrim(coalesce(_notitie,'')), '');
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  IF _wijze NOT IN ('gebeld','gemaild') THEN RAISE EXCEPTION 'kies gebeld of gemaild'; END IF;
  IF v_n IS NOT NULL AND length(v_n) > 1000 THEN RAISE EXCEPTION 'notitie te lang'; END IF;
  SELECT * INTO i FROM incasso_mislukt WHERE id = _id FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'niet gevonden'; END IF;
  v_notitie := public.crm_notitie_toevoegen(i.onderneming_id, NULL, CASE WHEN _wijze = 'gebeld' THEN 'telefoon' ELSE 'notitie' END,
    'Klant ' || _wijze || ' over openstaande factuur ' || i.factuurnummer || coalesce(': ' || v_n, ''),
    jsonb_build_object('incasso_id', _id, 'soort', 'incasso_contact', 'wijze', _wijze));
  UPDATE incasso_mislukt SET laatste_contact_op = now() WHERE id = _id;
  RETURN jsonb_build_object('id', _id, 'notitie_id', v_notitie);
END $$;

REVOKE ALL ON FUNCTION public.onderneming_bij_exact_account(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.onderneming_betaalachterstand(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.incasso_open_posten_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.incasso_handmatig_betaald(uuid, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.incasso_contact_gelegd(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incasso_handmatig_betaald(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incasso_contact_gelegd(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onderneming_bij_exact_account(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.onderneming_betaalachterstand(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.incasso_open_posten_sync() TO service_role;
REVOKE ALL ON FUNCTION public.review_kandidaten(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_herinnering_kandidaten(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_kandidaten(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_herinnering_kandidaten(integer) TO service_role;

CREATE OR REPLACE FUNCTION public._ts_incasso(p_naam text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a'; adm constant uuid := '5d591f12-d010-4640-ae68-2b4f58953320';
  c jsonb := '[]'; v uuid; r jsonb;
BEGIN
  INSERT INTO incasso_mislukt (onderneming_id, factuurnummer, bedrag, mislukt_op, bron, administratie, soort, cyclus_actief, is_test)
  VALUES (ond_a, 'TS-INC-1', 55, current_date - 30, 'handmatig', 'afas', 'storno', false, true) RETURNING id INTO v;
  IF p_naam = 'incasso_cyclus_uit' THEN
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    r := public.incasso_cyclus_stap(current_date);
    c := c || public._ts_c('geen cyclusstap (klantmail/opschorting) bij cyclus uit', '0', (SELECT count(*)::text FROM incasso_cyclus_log WHERE incasso_id = v))
           || public._ts_c('dekking niet opgeschort', NULL, (SELECT dekking_opgeschort_sinds::text FROM incasso_mislukt WHERE id = v));
  ELSIF p_naam = 'incasso_contact_betaald' THEN
    PERFORM public._ts_sessie(adm, 'aal2');
    PERFORM public.incasso_contact_gelegd(v, 'gebeld', 'scenario');
    c := c || public._ts_c('laatste contact gezet', 'true', (SELECT (laatste_contact_op IS NOT NULL)::text FROM incasso_mislukt WHERE id = v))
           || public._ts_c('CRM-notitie op klantkaart', '1', (SELECT count(*)::text FROM crm_notities WHERE onderneming_id = ond_a AND details->>'incasso_id' = v::text));
    BEGIN PERFORM public.incasso_handmatig_betaald(v, ''); c := c || public._ts_c('betaald zonder notitie geweigerd', 'fout', 'gelukt');
    EXCEPTION WHEN OTHERS THEN c := c || public._ts_c('betaald zonder notitie geweigerd', 'fout', 'fout'); END;
    PERFORM public.incasso_handmatig_betaald(v, 'Betaald per bank, gezien door scenario');
    c := c || public._ts_c('AFAS-post handmatig betaald', 'betaald', (SELECT status FROM incasso_mislukt WHERE id = v));
  ELSIF p_naam = 'review_betaalachterstand' THEN
    c := c || public._ts_c('open post = betaalachterstand', 'true', public.onderneming_betaalachterstand(ond_a)::text);
    UPDATE incasso_mislukt SET status = 'betaald', betaald_op = current_date WHERE id = v;
    c := c || public._ts_c('betaald = geen achterstand', 'false', public.onderneming_betaalachterstand(ond_a)::text);
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_incasso(text) FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.test_scenario(text)'::regprocedure);
  IF position('_ts_incasso' IN d) = 0 THEN
    d := replace(d, $r$'exact_adres_wachtrij'] || vitest$r$, $r$'exact_adres_wachtrij','incasso_cyclus_uit','incasso_contact_betaald','review_betaalachterstand'] || vitest$r$);
    d := replace(d, $r$    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$, $r$    ELSIF p_naam IN ('incasso_cyclus_uit','incasso_contact_betaald','review_betaalachterstand') THEN
      c := c || public._ts_incasso(p_naam);
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$);
    IF position('_ts_incasso' IN d) = 0 OR position('review_betaalachterstand''] || vitest' IN d) = 0 THEN
      RAISE EXCEPTION 'test_scenario kon niet worden uitgebreid';
    END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef('public._ts_tel()'::regprocedure);
  IF position('incasso_mislukt' IN d) = 0 THEN
    d := replace(d, $r$ARRAY['exact_adres_sync',$r$, $r$ARRAY['incasso_mislukt','exact_adres_sync',$r$);
    IF position('incasso_mislukt' IN d) = 0 THEN RAISE EXCEPTION '_ts_tel kon niet worden uitgebreid'; END IF;
    EXECUTE d;
  END IF;
END $do$;
REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ts_tel() FROM PUBLIC, anon, authenticated;