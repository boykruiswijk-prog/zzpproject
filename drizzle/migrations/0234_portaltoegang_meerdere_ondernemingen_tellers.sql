-- 1. Menutellers: portaltoegang en dubbele klanten erbij.
CREATE OR REPLACE FUNCTION public.tel_portaltoegang_open() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM klant_service_aanvragen
   WHERE NOT is_test AND gekoppeld_aan IS NULL AND type = 'portaltoegang' AND coalesce(status,'nieuw') IN ('nieuw','in_behandeling')
$$;
CREATE OR REPLACE FUNCTION public.tel_dubbele_klanten() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM (SELECT kvk FROM ondernemingen WHERE kvk IS NOT NULL AND samengevoegd_naar IS NULL AND NOT is_test GROUP BY kvk HAVING count(*) > 1) g
$$;
REVOKE ALL ON FUNCTION public.tel_portaltoegang_open() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tel_dubbele_klanten() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tel_portaltoegang_open() TO service_role;
GRANT EXECUTE ON FUNCTION public.tel_dubbele_klanten() TO service_role;

DO $do$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.menu_tellers'::regproc);
  IF position('''portaltoegang'', public.tel_portaltoegang_open()' in src) = 0 THEN
    src := replace(src, '  RETURN jsonb_build_object(', '  RETURN jsonb_build_object(' || chr(10) || '    ''portaltoegang'', public.tel_portaltoegang_open(),' || chr(10) || '    ''dubbele_klanten'', public.tel_dubbele_klanten(),');
    EXECUTE src;
  END IF;
END $do$;

-- 2. Automatische match: minstens één actieve, niet-test, niet-samengevoegde onderneming; meerdere personen met hetzelfde adres = twijfel.
CREATE OR REPLACE FUNCTION public.portaltoegang_auto_match(_email text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e text := lower(btrim(coalesce(_email,''))); n_pers int; testadres boolean; n_aflopend int; n_samengevoegd int; p record; ids uuid[]; r record;
BEGIN
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('match', false, 'reden', 'geen geldig e-mailadres'); END IF;
  testadres := e LIKE '%@zpzaken.nl';
  SELECT count(*) INTO n_pers FROM public.personen x
   WHERE (lower(btrim(x.genormaliseerd_email)) = e OR lower(btrim(x.email_weergave)) = e) AND (x.is_test = false OR testadres);
  IF n_pers = 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres staat bij geen contactpersoon van een klant'); END IF;
  IF n_pers > 1 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres hoort bij ' || n_pers || ' verschillende contactpersonen, kies zelf'); END IF;
  SELECT * INTO p FROM public.personen x
   WHERE (lower(btrim(x.genormaliseerd_email)) = e OR lower(btrim(x.email_weergave)) = e) AND (x.is_test = false OR testadres);
  SELECT array_agg(o.id ORDER BY o.created_at) INTO ids FROM public.persoon_onderneming po JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE po.persoon_id = p.id AND o.samengevoegd_naar IS NULL AND o.is_test = p.is_test
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND k.is_test = o.is_test);
  IF ids IS NULL THEN
    SELECT count(*) FILTER (WHERE o.samengevoegd_naar IS NOT NULL),
           count(*) FILTER (WHERE o.samengevoegd_naar IS NULL AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.is_test = o.is_test))
      INTO n_samengevoegd, n_aflopend
      FROM public.persoon_onderneming po JOIN public.ondernemingen o ON o.id = po.onderneming_id WHERE po.persoon_id = p.id;
    IF n_aflopend > 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'klant gevonden, maar het contract loopt af of is beëindigd'); END IF;
    IF n_samengevoegd > 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'contactpersoon hangt aan een samengevoegde klantkaart'); END IF;
    RETURN jsonb_build_object('match', false, 'reden', 'contactpersoon gevonden, maar geen contract in het klantenbestand (mogelijk online klant)');
  END IF;
  SELECT o.id, o.naam INTO r FROM public.ondernemingen o WHERE o.id = ids[1];
  RETURN jsonb_build_object('match', true, 'onderneming_id', r.id, 'persoon_id', p.id, 'klant', r.naam, 'voornaam', p.voornaam,
    'onderneming_ids', to_jsonb(ids), 'aantal_ondernemingen', (SELECT count(*) FROM public.persoon_onderneming po JOIN public.ondernemingen o ON o.id = po.onderneming_id
      WHERE po.persoon_id = p.id AND o.samengevoegd_naar IS NULL AND o.is_test = p.is_test));
END $function$;

-- Alle niet-samengevoegde ondernemingen van een persoon (zelfde testmarkering), ook beëindigde (historie).
CREATE OR REPLACE FUNCTION public.persoon_ondernemingen_ids(_persoon_id uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(array_agg(o.id), '{}') FROM persoon_onderneming po JOIN ondernemingen o ON o.id = po.onderneming_id JOIN personen x ON x.id = po.persoon_id
   WHERE po.persoon_id = _persoon_id AND o.samengevoegd_naar IS NULL AND o.is_test = x.is_test
$$;
REVOKE ALL ON FUNCTION public.persoon_ondernemingen_ids(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persoon_ondernemingen_ids(uuid) TO service_role;

-- 3. Vastleggen: polissen van al zijn ondernemingen koppelen (nooit een polis van een ander account overnemen).
CREATE OR REPLACE FUNCTION public.portaltoegang_auto_vastleggen(_aanvraag_id uuid, _onderneming_id uuid, _persoon_id uuid, _portal_user_id uuid, _user_created boolean, _message_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a public.klant_service_aanvragen; o public.ondernemingen; _polissen int; _op timestamptz := now(); _ids uuid[];
  _systeem constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF public.portal_user_id_by_email(lower(btrim(a.email))) IS DISTINCT FROM _portal_user_id THEN RAISE EXCEPTION 'gebruiker hoort niet bij dit adres'; END IF;
  _ids := public.persoon_ondernemingen_ids(_persoon_id);
  IF NOT (o.id = ANY(_ids)) THEN RAISE EXCEPTION 'onderneming hoort niet bij deze persoon'; END IF;
  WITH u AS (UPDATE public.policies p SET user_id = _portal_user_id
     WHERE (p.user_id IS NULL OR p.user_id = _portal_user_id)
       AND (p.onderneming_id = ANY(_ids) OR (p.onderneming_id IS NULL AND p.lead_id IN (SELECT l.id FROM public.leads l WHERE l.gekoppeld_onderneming_id = ANY(_ids))))
     RETURNING 1)
  SELECT count(*) INTO _polissen FROM u;
  UPDATE public.klant_service_aanvragen SET status = 'afgerond', behandeld_op = _op, onderneming_id = o.id,
    details = coalesce(details,'{}'::jsonb) || jsonb_build_object(
      'automatisch', jsonb_build_object('besluit', 'uitgenodigd', 'op', _op, 'reden', null),
      'toegang_verleend', jsonb_build_object('door', null, 'door_naam', 'automatisch', 'op', _op, 'email', lower(btrim(a.email)),
        'user_created', _user_created, 'persoon_id', _persoon_id, 'contactpersoon', 'bestaand', 'polissen_gekoppeld', _polissen, 'message_id', _message_id,
        'ondernemingen', to_jsonb(_ids)),
      'afgerond', jsonb_build_object('door', null, 'op', _op, 'toelichting', 'automatisch uitgenodigd'))
   WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'portaltoegang_auto_verleend', 'toegang', a.status, lower(btrim(a.email)), NULL, 'automatisch',
    jsonb_build_object('onderneming_id', o.id, 'ondernemingen', to_jsonb(_ids), 'persoon_id', _persoon_id, 'polissen_gekoppeld', _polissen, 'user_created', _user_created, 'message_id', _message_id));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, _persoon_id, 'overig', o.is_test, 'Automatisch uitgenodigd voor Mijn ZP op ' || lower(btrim(a.email)) || ' na een toegangsaanvraag.',
    _systeem, 'automatisch', jsonb_build_object('soort','portal_uitnodiging','email',lower(btrim(a.email)),'aanvraag_id',a.id,'automatisch',true,'ondernemingen',to_jsonb(_ids)));
  RETURN jsonb_build_object('ok', true, 'polissen_gekoppeld', _polissen, 'ondernemingen', array_length(_ids,1));
END $function$;

-- 4. Mijn ZP: ondernemingen van de ingelogde persoon, met eigen polissen per onderneming; zonder actief contract = historie.
CREATE OR REPLACE FUNCTION public.mijn_ondernemingen()
 RETURNS TABLE(onderneming_id uuid, naam text, kvk text, historie boolean, policy_ids uuid[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH mij AS (
    SELECT u.id, lower(trim(u.email)) AS email FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  ), via_persoon AS (
    SELECT o.id FROM mij
    JOIN public.personen p ON lower(btrim(p.genormaliseerd_email)) = mij.email AND (coalesce(p.is_test,false) = false OR mij.email LIKE '%@zpzaken.nl')
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id AND o.samengevoegd_naar IS NULL AND coalesce(o.is_test,false) = coalesce(p.is_test,false)
  ), pol AS (
    SELECT pl.id, coalesce(pl.onderneming_id, l.gekoppeld_onderneming_id) AS ond FROM mij
    JOIN public.policies pl ON pl.user_id = mij.id AND pl.status = 'geldig'
    LEFT JOIN public.leads l ON l.id = pl.lead_id
  ), ond AS (SELECT id FROM via_persoon UNION SELECT ond FROM pol WHERE ond IS NOT NULL)
  SELECT o.id, o.naam, o.kvk,
    NOT EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status IN ('actief','loopt_af','einddatum_controle'))
      AND NOT EXISTS (SELECT 1 FROM pol WHERE pol.ond = o.id),
    coalesce((SELECT array_agg(pol.id) FROM pol WHERE pol.ond = o.id), '{}')
  FROM ond JOIN public.ondernemingen o ON o.id = ond.id
  ORDER BY 4, o.naam
$$;
REVOKE ALL ON FUNCTION public.mijn_ondernemingen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_ondernemingen() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mijn_klant_contracten_per_onderneming()
 RETURNS TABLE(onderneming_id uuid, onderneming_naam text, product text, status text, begin_datum date, eind_datum date, certificaatnummer text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT m.onderneming_id, m.naam, kc.product::text, kc.status::text, kc.begin_datum, kc.eind_datum,
    (SELECT c.certificaatnummer FROM public.klant_certificaten c WHERE c.onderneming_id = m.onderneming_id AND c.koppeling_status = 'bevestigd'
      AND c.is_test IS NOT DISTINCT FROM kc.is_test ORDER BY c.created_at DESC LIMIT 1)
  FROM public.mijn_ondernemingen() m JOIN public.klant_contracten kc ON kc.onderneming_id = m.onderneming_id
  WHERE kc.status <> 'vervangen' AND (kc.product ILIKE 'bav%' OR kc.product ILIKE 'cyber%')
  ORDER BY kc.begin_datum DESC
$$;
REVOKE ALL ON FUNCTION public.mijn_klant_contracten_per_onderneming() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_klant_contracten_per_onderneming() TO authenticated, service_role;

-- 5. Admin: onderneming koppelen/ontkoppelen bij een persoon, met audit en tijdlijnnotitie.
CREATE OR REPLACE FUNCTION public.persoon_onderneming_koppelen(_persoon_id uuid, _onderneming_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); p public.personen; o public.ondernemingen; _uid uuid; _pol int := 0; _naam text;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO p FROM public.personen WHERE id = _persoon_id;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF p.id IS NULL OR o.id IS NULL THEN RAISE EXCEPTION 'persoon of onderneming niet gevonden'; END IF;
  IF o.samengevoegd_naar IS NOT NULL THEN RAISE EXCEPTION 'deze klantkaart is samengevoegd; koppel de hoofdkaart'; END IF;
  IF o.is_test IS DISTINCT FROM p.is_test THEN RAISE EXCEPTION 'test en echt niet door elkaar koppelen'; END IF;
  IF EXISTS (SELECT 1 FROM public.persoon_onderneming WHERE persoon_id = p.id AND onderneming_id = o.id) THEN RETURN jsonb_build_object('ok', true, 'al_gekoppeld', true); END IF;
  INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id) VALUES (p.id, o.id);
  -- Heeft de persoon al Mijn ZP: polissen van deze onderneming zonder account meteen zichtbaar maken.
  _uid := public.portal_user_id_by_email(lower(btrim(p.genormaliseerd_email)));
  IF _uid IS NOT NULL THEN
    WITH u AS (UPDATE public.policies pl SET user_id = _uid WHERE pl.user_id IS NULL
      AND (pl.onderneming_id = o.id OR (pl.onderneming_id IS NULL AND pl.lead_id IN (SELECT l.id FROM public.leads l WHERE l.gekoppeld_onderneming_id = o.id))) RETURNING 1)
    SELECT count(*) INTO _pol FROM u;
  END IF;
  SELECT coalesce(nullif(btrim(coalesce(pr.full_name,'')),''), pr.email) INTO _naam FROM public.profiles pr WHERE pr.user_id = me;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('persoon_onderneming', p.id, 'onderneming_gekoppeld', 'onderneming_id', NULL, o.id::text, me, 'team', jsonb_build_object('onderneming', o.naam, 'polissen_gekoppeld', _pol));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, p.id, 'overig', o.is_test, 'Contactpersoon gekoppeld aan ' || o.naam || '.', me, coalesce(_naam,'team'), jsonb_build_object('soort','persoon_onderneming_gekoppeld','polissen_gekoppeld',_pol));
  RETURN jsonb_build_object('ok', true, 'polissen_gekoppeld', _pol);
END $function$;

CREATE OR REPLACE FUNCTION public.persoon_onderneming_ontkoppelen(_persoon_id uuid, _onderneming_id uuid, _reden text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); p public.personen; o public.ondernemingen; _uid uuid; _pol int := 0; _naam text;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 5 THEN RAISE EXCEPTION 'geef een reden (minimaal 5 tekens)'; END IF;
  SELECT * INTO p FROM public.personen WHERE id = _persoon_id;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF NOT EXISTS (SELECT 1 FROM public.persoon_onderneming WHERE persoon_id = _persoon_id AND onderneming_id = _onderneming_id) THEN RAISE EXCEPTION 'niet gekoppeld'; END IF;
  DELETE FROM public.persoon_onderneming WHERE persoon_id = p.id AND onderneming_id = o.id;
  -- Mijn ZP-toegang tot polissen van deze onderneming vervalt, tenzij een andere contactpersoon met hetzelfde adres er nog aan hangt.
  _uid := public.portal_user_id_by_email(lower(btrim(p.genormaliseerd_email)));
  IF _uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.persoon_onderneming po JOIN public.personen x ON x.id = po.persoon_id
       WHERE po.onderneming_id = o.id AND lower(btrim(x.genormaliseerd_email)) = lower(btrim(p.genormaliseerd_email))) THEN
    WITH u AS (UPDATE public.policies pl SET user_id = NULL WHERE pl.user_id = _uid
      AND (pl.onderneming_id = o.id OR (pl.onderneming_id IS NULL AND pl.lead_id IN (SELECT l.id FROM public.leads l WHERE l.gekoppeld_onderneming_id = o.id))) RETURNING 1)
    SELECT count(*) INTO _pol FROM u;
  END IF;
  SELECT coalesce(nullif(btrim(coalesce(pr.full_name,'')),''), pr.email) INTO _naam FROM public.profiles pr WHERE pr.user_id = me;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('persoon_onderneming', p.id, 'onderneming_ontkoppeld', 'onderneming_id', o.id::text, NULL, me, 'team', jsonb_build_object('onderneming', o.naam, 'reden', btrim(_reden), 'polissen_losgemaakt', _pol));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, p.id, 'overig', o.is_test, 'Contactpersoon ontkoppeld van ' || o.naam || ': ' || btrim(_reden), me, coalesce(_naam,'team'), jsonb_build_object('soort','persoon_onderneming_ontkoppeld','polissen_losgemaakt',_pol));
  RETURN jsonb_build_object('ok', true, 'polissen_losgemaakt', _pol);
END $function$;
REVOKE ALL ON FUNCTION public.persoon_onderneming_koppelen(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.persoon_onderneming_ontkoppelen(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.persoon_onderneming_koppelen(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persoon_onderneming_ontkoppelen(uuid, uuid, text) TO authenticated;