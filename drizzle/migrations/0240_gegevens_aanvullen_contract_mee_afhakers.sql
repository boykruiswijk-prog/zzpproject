-- Besluit Boy 4-11 (verzoeken Ellen): gegevens aanvullen in Mijn ZP, contract mee bij rechtsvormwijziging, afhakers alleen tellen als er een handeling nodig is.

-- A. Mijn ZP: klant vult zelf telefoonnummer en adres aan (alleen eigen gegevens, alleen lege velden, tijdlijn + audit, nooit mail).
CREATE TABLE public.mijn_gegevens_later (
  user_id uuid PRIMARY KEY,
  later_tot timestamptz NOT NULL,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mijn_gegevens_later TO service_role;
ALTER TABLE public.mijn_gegevens_later ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.telefoon_normaliseer(_v text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN s ~ '^(\+31|0031|0)[1-9][0-9]{8}$' THEN regexp_replace(s, '^(\+31|0031)', '0')
    WHEN s ~ '^(\+|00)[1-9][0-9]{7,14}$' THEN regexp_replace(s, '^00', '+')
    ELSE NULL END
  FROM (SELECT regexp_replace(coalesce(_v,''), '[\s().-]', '', 'g') AS s) x
$function$;
GRANT EXECUTE ON FUNCTION public.telefoon_normaliseer(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mijn_persoon_ids()
 RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(p.id), '{}') FROM public.personen p
   JOIN auth.users u ON u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = lower(p.genormaliseerd_email)
$function$;
REVOKE ALL ON FUNCTION public.mijn_persoon_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mijn_persoon_ids() TO service_role;

CREATE OR REPLACE FUNCTION public.mijn_gegevens_status()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); v_pers uuid[]; v_tel boolean; v_adr jsonb; v_later timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'niet ingelogd'; END IF;
  v_pers := public.mijn_persoon_ids();
  IF coalesce(array_length(v_pers,1),0) = 0 THEN RETURN jsonb_build_object('tonen', false); END IF;
  v_tel := NOT EXISTS (SELECT 1 FROM personen WHERE id = ANY(v_pers) AND public.telefoon_normaliseer(telefoon) IS NOT NULL);
  SELECT coalesce(jsonb_agg(jsonb_build_object('onderneming_id', o.id, 'naam', o.naam,
      'straat', o.straat, 'huisnummer', o.huisnummer, 'postcode', o.postcode, 'plaats', o.plaats) ORDER BY o.naam), '[]'::jsonb)
    INTO v_adr
    FROM ondernemingen o
   WHERE o.id IN (SELECT po.onderneming_id FROM persoon_onderneming po WHERE po.persoon_id = ANY(v_pers))
     AND o.samengevoegd_naar IS NULL
     AND NOT (coalesce(btrim(o.straat),'') <> '' AND coalesce(btrim(o.huisnummer),'') <> '' AND coalesce(btrim(o.postcode),'') <> '' AND coalesce(btrim(o.plaats),'') <> '')
     AND NOT (coalesce(btrim(o.kvk_straat),'') <> '' AND coalesce(btrim(o.kvk_huisnummer),'') <> '' AND coalesce(btrim(o.kvk_postcode),'') <> '' AND coalesce(btrim(o.kvk_plaats),'') <> '');
  SELECT later_tot INTO v_later FROM mijn_gegevens_later WHERE user_id = me;
  RETURN jsonb_build_object('tonen', (v_tel OR jsonb_array_length(v_adr) > 0) AND (v_later IS NULL OR v_later <= now()),
    'telefoon_ontbreekt', v_tel, 'adressen', v_adr, 'later_tot', v_later);
END $function$;
REVOKE ALL ON FUNCTION public.mijn_gegevens_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_gegevens_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.mijn_gegevens_later()
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); v timestamptz := now() + interval '7 days';
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'niet ingelogd'; END IF;
  INSERT INTO mijn_gegevens_later (user_id, later_tot) VALUES (me, v)
  ON CONFLICT (user_id) DO UPDATE SET later_tot = EXCLUDED.later_tot, bijgewerkt_op = now();
  RETURN v;
END $function$;
REVOKE ALL ON FUNCTION public.mijn_gegevens_later() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_gegevens_later() TO authenticated;

CREATE OR REPLACE FUNCTION public.mijn_gegevens_aanvullen(_telefoon text, _adressen jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); v_pers uuid[]; v_tel text; v_n_tel int := 0; a jsonb; o ondernemingen; v_ond uuid;
  v_straat text; v_nr text; v_pc text; v_pl text; v_velden text[]; v_alle text[] := '{}'; v_ond_ids uuid[] := '{}'; v_naam text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'niet ingelogd'; END IF;
  v_pers := public.mijn_persoon_ids();
  IF coalesce(array_length(v_pers,1),0) = 0 THEN RAISE EXCEPTION 'geen klantgegevens gevonden voor dit account'; END IF;
  SELECT nullif(btrim(coalesce(voornaam,'') || ' ' || coalesce(achternaam,'')),'') INTO v_naam FROM personen WHERE id = v_pers[1];

  IF nullif(btrim(coalesce(_telefoon,'')),'') IS NOT NULL THEN
    v_tel := public.telefoon_normaliseer(_telefoon);
    IF v_tel IS NULL THEN RAISE EXCEPTION 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678 of +32 470 12 34 56.'; END IF;
    WITH u AS (UPDATE personen SET telefoon = v_tel, updated_at = now()
                WHERE id = ANY(v_pers) AND public.telefoon_normaliseer(telefoon) IS NULL RETURNING id)
    SELECT count(*) INTO v_n_tel FROM u;
    IF v_n_tel > 0 THEN v_alle := v_alle || 'telefoonnummer'; END IF;
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(_adressen,'[]'::jsonb)) LOOP
    v_ond := nullif(a->>'onderneming_id','')::uuid;
    IF v_ond IS NULL OR NOT EXISTS (SELECT 1 FROM persoon_onderneming WHERE onderneming_id = v_ond AND persoon_id = ANY(v_pers)) THEN
      RAISE EXCEPTION 'geen toegang tot deze onderneming';
    END IF;
    SELECT * INTO o FROM ondernemingen WHERE id = v_ond FOR UPDATE;
    v_straat := nullif(btrim(coalesce(a->>'straat','')),''); v_nr := nullif(btrim(coalesce(a->>'huisnummer','')),'');
    v_pc := upper(regexp_replace(coalesce(a->>'postcode',''), '\s', '', 'g')); v_pl := nullif(btrim(coalesce(a->>'plaats','')),'');
    IF v_pc ~ '^[1-9][0-9]{3}[A-Z]{2}$' THEN v_pc := substr(v_pc,1,4) || ' ' || substr(v_pc,5,2); END IF;
    v_pc := nullif(v_pc,'');
    IF v_straat IS NOT NULL AND length(v_straat) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Straat is te kort of te lang.'; END IF;
    IF v_nr IS NOT NULL AND (length(v_nr) > 15 OR v_nr !~ '[0-9]') THEN RAISE EXCEPTION 'Vul een geldig huisnummer in.'; END IF;
    IF v_pc IS NOT NULL AND length(v_pc) NOT BETWEEN 4 AND 10 THEN RAISE EXCEPTION 'Vul een geldige postcode in.'; END IF;
    IF v_pl IS NOT NULL AND length(v_pl) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Vul een geldige plaats in.'; END IF;
    v_velden := '{}';
    IF v_straat IS NOT NULL AND coalesce(btrim(o.straat),'') = '' THEN v_velden := v_velden || 'straat'; END IF;
    IF v_nr IS NOT NULL AND coalesce(btrim(o.huisnummer),'') = '' THEN v_velden := v_velden || 'huisnummer'; END IF;
    IF v_pc IS NOT NULL AND coalesce(btrim(o.postcode),'') = '' THEN v_velden := v_velden || 'postcode'; END IF;
    IF v_pl IS NOT NULL AND coalesce(btrim(o.plaats),'') = '' THEN v_velden := v_velden || 'plaats'; END IF;
    IF array_length(v_velden,1) > 0 THEN
      UPDATE ondernemingen SET
        straat = CASE WHEN 'straat' = ANY(v_velden) THEN v_straat ELSE straat END,
        huisnummer = CASE WHEN 'huisnummer' = ANY(v_velden) THEN v_nr ELSE huisnummer END,
        postcode = CASE WHEN 'postcode' = ANY(v_velden) THEN v_pc ELSE postcode END,
        plaats = CASE WHEN 'plaats' = ANY(v_velden) THEN v_pl ELSE plaats END,
        updated_at = now()
       WHERE id = v_ond;
      v_alle := v_alle || ('adres ' || o.naam); v_ond_ids := v_ond_ids || v_ond;
      INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
      VALUES ('ondernemingen', v_ond, 'klant_zelf_aangevuld', array_to_string(v_velden, ','), NULL, NULL, me, 'klant', jsonb_build_object('bron', 'mijn_zp'));
    END IF;
  END LOOP;

  IF v_n_tel > 0 THEN
    INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    SELECT 'personen', p, 'klant_zelf_aangevuld', 'telefoon', NULL, NULL, me, 'klant', jsonb_build_object('bron', 'mijn_zp') FROM unnest(v_pers) p;
  END IF;

  IF array_length(v_alle,1) > 0 THEN
    IF array_length(v_ond_ids,1) IS NULL THEN
      SELECT coalesce(array_agg(DISTINCT onderneming_id), '{}') INTO v_ond_ids FROM persoon_onderneming WHERE persoon_id = ANY(v_pers);
    END IF;
    INSERT INTO crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
    SELECT x, v_pers[1], 'overig', 'De klant heeft zelf in Mijn ZP aangevuld: ' || array_to_string(v_alle, ', ') || '.', me,
           coalesce(v_naam, 'Klant') || ' (via Mijn ZP)', coalesce((SELECT is_test FROM ondernemingen WHERE id = x), false),
           jsonb_build_object('soort', 'klant_zelf_aangevuld', 'velden', to_jsonb(v_alle))
      FROM unnest(v_ond_ids) x;
  END IF;
  DELETE FROM mijn_gegevens_later WHERE user_id = me;
  RETURN jsonb_build_object('ok', true, 'aangevuld', to_jsonb(v_alle));
END $function$;
REVOKE ALL ON FUNCTION public.mijn_gegevens_aanvullen(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_gegevens_aanvullen(text, jsonb) TO authenticated;

-- B. Rechtsvormwijziging zonder eigen contract bij de opvolger: BAV + AVB-contract gaat mee (geen dubbele factuur, geen creditnota).
ALTER TABLE public.crm_taken DROP CONSTRAINT crm_taken_soort_check;
ALTER TABLE public.crm_taken ADD CONSTRAINT crm_taken_soort_check CHECK (soort = ANY (ARRAY['exact_aanpassen','nieuwe_aanvraag_nodig','afas_factuur_opvragen','incasso_mislukt_bellen','royement_bevestigen','nps_laag_bellen','opvolger_exact_machtiging']));

CREATE OR REPLACE FUNCTION public.contract_meenemen_kern(_opvolging_id uuid, _door uuid, _door_email text, _door_naam text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o onderneming_opvolging; vo ondernemingen; nn ondernemingen; k record; v_ids uuid[] := '{}'; v_ongedaan boolean;
  v_bav text; v_mandaat boolean; v_wat text[] := '{}'; v_taak uuid; v_gesloten int := 0; v_eerste date;
BEGIN
  IF _door IS NULL THEN RAISE EXCEPTION 'uitvoerder ontbreekt'; END IF;
  SELECT * INTO o FROM onderneming_opvolging WHERE id = _opvolging_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'opvolging niet gevonden'; END IF;
  IF o.soort <> 'rechtsvormwijziging' THEN RAISE EXCEPTION 'het contract gaat alleen mee bij een rechtsvormwijziging'; END IF;
  SELECT * INTO vo FROM ondernemingen WHERE id = o.van_onderneming_id FOR UPDATE;
  SELECT * INTO nn FROM ondernemingen WHERE id = o.naar_onderneming_id FOR UPDATE;
  IF nn.samengevoegd_naar IS NOT NULL THEN RAISE EXCEPTION 'nieuwe onderneming is samengevoegd; kies de hoofdkaart'; END IF;
  IF nn.is_test IS DISTINCT FROM vo.is_test THEN RAISE EXCEPTION 'test en echt niet door elkaar'; END IF;
  IF public.onderneming_is_partner(vo.id) IS NOT NULL THEN RAISE EXCEPTION 'voorganger komt via partner: contract niet meenemen'; END IF;
  IF EXISTS (SELECT 1 FROM klant_contracten c WHERE c.onderneming_id = nn.id AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle')
              AND (c.eind_datum IS NULL OR c.eind_datum >= o.ingangsdatum)) THEN
    RAISE EXCEPTION 'de opvolger heeft al een eigen BAV + AVB-contract';
  END IF;

  FOR k IN SELECT * FROM klant_contracten c WHERE c.onderneming_id = vo.id AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle')
             AND (c.eind_datum IS NULL OR c.eind_datum >= o.ingangsdatum - 1) ORDER BY c.begin_datum FOR UPDATE LOOP
    IF EXISTS (SELECT 1 FROM sensitive_audit_log a WHERE a.target_table = 'klant_contracten' AND a.target_id = k.id
                AND a.actie IN ('opzegging_verwerken','opzegging_verwerkt','einddatum_opzegging_bevestigd')) THEN CONTINUE; END IF;
    v_ongedaan := k.eind_datum IS NOT NULL AND k.eind_datum = o.ingangsdatum - 1 AND EXISTS (SELECT 1 FROM sensitive_audit_log a
                   WHERE a.target_table = 'klant_contracten' AND a.target_id = k.id AND a.actie = 'handmatig_beeindigd' AND a.details->>'reden' = 'ondernemingswijziging');
    IF k.eind_datum IS NOT NULL AND NOT v_ongedaan THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM factuur_planning f WHERE f.klant_contract_id = k.id AND f.status NOT IN ('verwerkt','vervangen')) THEN
      RAISE EXCEPTION 'contract % heeft nog een factuur in behandeling; rond die eerst af', k.id; END IF;
    IF EXISTS (SELECT 1 FROM factuur_credit_planning f WHERE f.klant_contract_id = k.id AND f.status IN ('te_maken','wacht_op_akkoord','geblokkeerd','concept_niet_verwerkt')) THEN
      RAISE EXCEPTION 'contract % heeft een openstaande creditnota; beoordeel die eerst', k.id; END IF;
    UPDATE klant_contracten SET onderneming_id = nn.id,
      eind_datum = CASE WHEN v_ongedaan THEN NULL ELSE eind_datum END,
      status = CASE WHEN v_ongedaan THEN 'actief' ELSE status END
     WHERE id = k.id;
    INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
    VALUES ('klant_contracten', k.id, 'contract_meegenomen', 'onderneming_id', vo.id::text, nn.id::text, _door, _door_email, 'team',
      jsonb_build_object('opvolging_id', o.id, 'van', vo.naam, 'naar', nn.naam, 'ingangsdatum', o.ingangsdatum,
        'gefactureerd_tm', k.gefactureerd_tm, 'volgende_factuurdatum', k.volgende_factuurdatum,
        'einde_ongedaan', v_ongedaan, 'oude_eind_datum', k.eind_datum, 'oude_status', k.status,
        'regel', 'geen dubbele factuur en geen creditnota; gefactureerde perioden blijven, planner factureert vanaf de volgende periode aan de opvolger'));
    v_ids := v_ids || k.id;
    v_eerste := coalesce(v_eerste, k.volgende_factuurdatum);
  END LOOP;
  IF array_length(v_ids,1) IS NULL THEN RAISE EXCEPTION 'geen lopend BAV + AVB-contract bij de voorganger om mee te nemen'; END IF;

  IF coalesce(btrim(o.bav_nummer),'') = '' THEN
    SELECT certificate_number INTO v_bav FROM policies WHERE onderneming_id = vo.id AND status = 'geldig' ORDER BY versie DESC LIMIT 1;
    IF v_bav IS NULL THEN
      SELECT upper(btrim(certificaatnummer)) INTO v_bav FROM klant_certificaten WHERE onderneming_id = vo.id AND koppeling_status = 'bevestigd' AND NOT is_test
       ORDER BY aanvraagdatum DESC NULLS LAST LIMIT 1;
    END IF;
    IF v_bav IS NOT NULL THEN UPDATE onderneming_opvolging SET bav_nummer = v_bav, bav_nummer_herkomst = 'zp' WHERE id = o.id; END IF;
  ELSE v_bav := o.bav_nummer;
  END IF;

  WITH u AS (UPDATE crm_taken SET status = 'afgerond', afgerond_door = _door, afgerond_op = now()
              WHERE status = 'open' AND soort = 'nieuwe_aanvraag_nodig' AND details->>'opvolging_id' = o.id::text RETURNING id),
       a AS (INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
             SELECT 'crm_taken', id, 'afgerond', 'status', 'open', 'afgerond', _door, 'team', jsonb_build_object('reden', 'contract gaat mee met rechtsvormwijziging') FROM u RETURNING 1)
  SELECT count(*) INTO v_gesloten FROM a;

  v_mandaat := EXISTS (SELECT 1 FROM klant_mandaten m WHERE m.onderneming_id = nn.id);
  IF nn.exact_account_id IS NULL THEN v_wat := v_wat || 'Exact-relatie aanmaken via de relatieroute (eigen relatiecode, nooit die van de voorganger)'; END IF;
  IF NOT v_mandaat THEN v_wat := v_wat || 'incassomachtiging van de BV opvragen'; END IF;
  IF array_length(v_wat,1) > 0 AND NOT EXISTS (SELECT 1 FROM crm_taken WHERE status = 'open' AND soort = 'opvolger_exact_machtiging' AND onderneming_id = nn.id) THEN
    INSERT INTO crm_taken (soort, team, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
    VALUES ('opvolger_exact_machtiging', 'verzekering', nn.id,
      nn.naam || ' (opvolger van ' || vo.naam || ' per ' || to_char(o.ingangsdatum,'DD-MM-YYYY') || '): ' || array_to_string(v_wat, '; ') || '. '
      || 'Tot de BV aan Exact gekoppeld is maakt de planner geen factuur; volgende factuurdatum ' || coalesce(to_char(v_eerste,'DD-MM-YYYY'),'onbekend') || '.',
      jsonb_build_object('opvolging_id', o.id, 'van_onderneming_id', vo.id, 'contract_ids', to_jsonb(v_ids), 'exact_ontbreekt', nn.exact_account_id IS NULL, 'machtiging_ontbreekt', NOT v_mandaat),
      _door, coalesce(_door_naam, 'team'), coalesce(nn.is_test,false))
    RETURNING id INTO v_taak;
  END IF;

  INSERT INTO crm_notities (onderneming_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (vo.id, 'overig', coalesce(vo.is_test,false), 'BAV + AVB-contract meegegaan naar ' || nn.naam || ' per ' || to_char(o.ingangsdatum,'DD-MM-YYYY')
            || '. Al gefactureerde perioden blijven staan; geen creditnota.', _door, coalesce(_door_naam,'team'), jsonb_build_object('soort','contract_meegenomen','opvolging_id',o.id)),
         (nn.id, 'overig', coalesce(nn.is_test,false), 'BAV + AVB-contract overgenomen van ' || vo.naam || ' per ' || to_char(o.ingangsdatum,'DD-MM-YYYY')
            || coalesce(', BAV-nummer ' || v_bav, '') || '. Volgende factuur ' || coalesce(to_char(v_eerste,'DD-MM-YYYY'),'onbekend') || ' aan deze onderneming; geen dubbele factuur en geen creditnota.',
            _door, coalesce(_door_naam,'team'), jsonb_build_object('soort','contract_meegenomen','opvolging_id',o.id));
  RETURN jsonb_build_object('ok', true, 'contracten', to_jsonb(v_ids), 'bav_nummer', v_bav, 'volgende_factuurdatum', v_eerste,
    'taak_id', v_taak, 'taken_afgerond', v_gesloten);
END $function$;
REVOKE ALL ON FUNCTION public.contract_meenemen_kern(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_meenemen_kern(uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_meenemen(_opvolging_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); v_email text; v_naam text;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = me;
  SELECT nullif(btrim(coalesce(full_name,'')),'') INTO v_naam FROM profiles WHERE id = me;
  RETURN public.contract_meenemen_kern(_opvolging_id, me, v_email, v_naam);
END $function$;
REVOKE ALL ON FUNCTION public.contract_meenemen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_meenemen(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean);
CREATE FUNCTION public.crm_ondernemingswijziging(_van uuid, _naar uuid, _naam text, _kvk text, _rechtsvorm text, _ingangsdatum date, _soort text, _toelichting text, _beeindigen boolean DEFAULT true, _polis_meenemen boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.ondernemingen; v_naar uuid := _naar; v_opv uuid; v_stop jsonb; v_c uuid[]; v_p uuid[]; v_notitie uuid; v_naam text;
  v_mee boolean := coalesce(_polis_meenemen,false) AND _soort = 'rechtsvormwijziging'; v_contract_mee boolean := false; v_mee_res jsonb;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _van;
  IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF _ingangsdatum IS NULL THEN RAISE EXCEPTION 'ingangsdatum is verplicht'; END IF;
  IF _soort NOT IN ('rechtsvormwijziging','overname','overig') THEN RAISE EXCEPTION 'ongeldige soort'; END IF;
  IF v_naar IS NULL THEN
    IF length(btrim(coalesce(_naam,''))) < 2 THEN RAISE EXCEPTION 'naam nieuwe onderneming is verplicht'; END IF;
    IF nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),'') IS NOT NULL AND length(regexp_replace(_kvk,'\D','','g')) <> 8 THEN RAISE EXCEPTION 'KvK-nummer moet 8 cijfers zijn'; END IF;
    INSERT INTO public.ondernemingen (naam, kvk, rechtsvorm, is_test, bron, branche, sector)
    VALUES (btrim(_naam), nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),''), nullif(btrim(coalesce(_rechtsvorm,'')),''), o.is_test, 'ondernemingswijziging', o.branche, o.sector)
    RETURNING id INTO v_naar;
  ELSIF v_naar = _van THEN RAISE EXCEPTION 'kies een andere onderneming';
  END IF;
  SELECT naam INTO v_naam FROM public.ondernemingen WHERE id = v_naar;
  v_contract_mee := _soort = 'rechtsvormwijziging'
    AND EXISTS (SELECT 1 FROM public.klant_contracten c WHERE c.onderneming_id = _van AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle') AND (c.eind_datum IS NULL OR c.eind_datum >= _ingangsdatum))
    AND NOT EXISTS (SELECT 1 FROM public.klant_contracten c WHERE c.onderneming_id = v_naar AND c.product = 'bav_avb' AND c.status IN ('actief','loopt_af','einddatum_controle') AND (c.eind_datum IS NULL OR c.eind_datum >= _ingangsdatum));
  INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test)
  VALUES (_van, v_naar, _ingangsdatum, _soort, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), o.is_test) RETURNING id INTO v_opv;
  INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT persoon_id, v_naar FROM public.persoon_onderneming WHERE onderneming_id = _van ON CONFLICT DO NOTHING;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('onderneming_opvolging', v_opv, 'ondernemingswijziging', 'naar_onderneming_id', _van::text, v_naar::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('ingangsdatum', _ingangsdatum, 'soort', _soort, 'beeindigen', _beeindigen, 'polis_meenemen', v_mee, 'contract_meenemen', v_contract_mee));
  v_notitie := public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
    'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce(E'\nToelichting: ' || nullif(btrim(coalesce(_toelichting,'')),''), ''),
    jsonb_build_object('opvolging_id', v_opv, 'naar_onderneming_id', v_naar));
  IF _beeindigen THEN
    SELECT array_agg(id) INTO v_c FROM public.klant_contracten WHERE onderneming_id = _van AND status IN ('actief','loopt_af','einddatum_controle') AND (eind_datum IS NULL OR eind_datum > _ingangsdatum)
      AND NOT (v_contract_mee AND product = 'bav_avb');
    IF NOT v_mee THEN SELECT array_agg(id) INTO v_p FROM public.policies WHERE onderneming_id = _van AND status = 'geldig'; END IF;
    IF coalesce(array_length(v_c,1),0) + coalesce(array_length(v_p,1),0) > 0 THEN
      v_stop := public.crm_beeindig(_van, coalesce(v_c,'{}'), coalesce(v_p,'{}'), _ingangsdatum - 1, 'ondernemingswijziging',
        'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce('. ' || nullif(btrim(coalesce(_toelichting,'')),''), ''));
    END IF;
  END IF;
  IF v_contract_mee THEN
    v_mee_res := public.contract_meenemen_kern(v_opv, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()),
      (SELECT nullif(btrim(coalesce(full_name,'')),'') FROM public.profiles WHERE id = auth.uid()));
  END IF;
  DECLARE v_nieuw public.ondernemingen; v_had boolean; BEGIN
    SELECT * INTO v_nieuw FROM public.ondernemingen WHERE id = v_naar;
    v_had := EXISTS (SELECT 1 FROM public.klant_contracten WHERE onderneming_id = _van) OR EXISTS (SELECT 1 FROM public.policies WHERE onderneming_id = _van);
    IF NOT v_mee AND NOT v_contract_mee AND (v_nieuw.kvk IS DISTINCT FROM o.kvk OR v_had) THEN
      INSERT INTO public.crm_taken (soort, team, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
      VALUES ('nieuwe_aanvraag_nodig', 'verzekering', v_naar,
        'Nieuwe aanvraag nodig: ' || o.naam || ' gaat verder als ' || v_nieuw.naam || ' (KvK ' || coalesce(v_nieuw.kvk,'onbekend') || ') per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '. Polis kan niet worden overgezet.',
        jsonb_build_object('opvolging_id', v_opv, 'van_onderneming_id', _van, 'oude_kvk', o.kvk, 'nieuwe_kvk', v_nieuw.kvk),
        auth.uid(), coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()),'teamlid'), o.is_test OR v_nieuw.is_test);
    END IF;
  END;
  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar, 'opvolging_id', v_opv, 'notitie_id', v_notitie, 'stop', v_stop, 'polis_meenemen', v_mee, 'contract_meenemen', v_mee_res);
END $function$;
REVOKE ALL ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean) TO authenticated;

-- C. Afgehaakte aanvragen: gezien, contact vastleggen, automatisch afronden na de wachttijd.
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS gezien_op timestamptz;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS contact_vastgelegd_op timestamptz;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS afgerond_op timestamptz;
ALTER TABLE public.aanvraag_concepten DROP CONSTRAINT aanvraag_concepten_status_check;
ALTER TABLE public.aanvraag_concepten ADD CONSTRAINT aanvraag_concepten_status_check CHECK (status = ANY (ARRAY['open','omgezet','gebeld','geen_interesse','onbereikbaar','dubbel','afgerond_na_herinnering']));

CREATE TABLE public.afhaker_contacten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES public.aanvraag_concepten(id),
  soort text NOT NULL CHECK (soort IN ('gebeld','gemaild','notitie')),
  tekst text NOT NULL CHECK (length(btrim(tekst)) BETWEEN 1 AND 2000),
  door uuid NOT NULL,
  door_naam text,
  op timestamptz NOT NULL DEFAULT now(),
  crm_notitie_id uuid,
  is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX afhaker_contacten_concept_idx ON public.afhaker_contacten (concept_id);
GRANT SELECT ON public.afhaker_contacten TO authenticated;
GRANT ALL ON public.afhaker_contacten TO service_role;
ALTER TABLE public.afhaker_contacten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest afhakercontact" ON public.afhaker_contacten FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'));

CREATE OR REPLACE FUNCTION public.afhakers_gezien(_ids uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) OR coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'geen toegang'; END IF;
  UPDATE aanvraag_concepten SET gezien_op = now() WHERE id = ANY(coalesce(_ids,'{}')) AND gezien_op IS NULL AND status = 'open';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.afhakers_gezien(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.afhakers_gezien(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.afhaker_contact_vastleggen(_concept_id uuid, _soort text, _tekst text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); c aanvraag_concepten; v_naam text; v_notitie uuid; v_id uuid; v_label text;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _soort NOT IN ('gebeld','gemaild','notitie') THEN RAISE EXCEPTION 'kies gebeld, gemaild of notitie'; END IF;
  IF length(btrim(coalesce(_tekst,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'vul een korte toelichting in (maximaal 2000 tekens)'; END IF;
  SELECT * INTO c FROM aanvraag_concepten WHERE id = _concept_id FOR UPDATE;
  IF c.id IS NULL OR c.geanonimiseerd_op IS NOT NULL THEN RAISE EXCEPTION 'afhaker niet gevonden'; END IF;
  SELECT nullif(btrim(coalesce(full_name,'')),'') INTO v_naam FROM profiles WHERE id = me;
  v_label := CASE _soort WHEN 'gebeld' THEN 'Gebeld' WHEN 'gemaild' THEN 'Gemaild' ELSE 'Notitie' END;
  IF c.gekoppeld_onderneming_id IS NOT NULL OR c.gekoppeld_persoon_id IS NOT NULL THEN
    INSERT INTO crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
    VALUES (c.gekoppeld_onderneming_id, c.gekoppeld_persoon_id, CASE WHEN _soort = 'gebeld' THEN 'telefoon' ELSE 'notitie' END,
      'Afgehaakte aanvraag, ' || lower(v_label) || ': ' || btrim(_tekst), me, coalesce(v_naam,'team'), c.is_test,
      jsonb_build_object('soort','afhaker_contact','concept_id',c.id,'contact',_soort))
    RETURNING id INTO v_notitie;
  END IF;
  INSERT INTO afhaker_contacten (concept_id, soort, tekst, door, door_naam, crm_notitie_id, is_test)
  VALUES (c.id, _soort, btrim(_tekst), me, v_naam, v_notitie, c.is_test) RETURNING id INTO v_id;
  UPDATE aanvraag_concepten SET contact_vastgelegd_op = now(), gezien_op = coalesce(gezien_op, now()), opgevolgd_door = me, opgevolgd_op = now() WHERE id = c.id;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'in_tijdlijn', v_notitie IS NOT NULL);
END $function$;
REVOKE ALL ON FUNCTION public.afhaker_contact_vastleggen(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.afhaker_contact_vastleggen(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.afhakers_overzicht(_ids uuid[])
 RETURNS TABLE(concept_id uuid, mails jsonb, contacten jsonb, aanvraag_lead_id uuid, aanvraag_op timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN QUERY
  SELECT c.id,
    coalesce((SELECT jsonb_agg(jsonb_build_object('soort', CASE WHEN n.metadata ? 'eenmalig' THEN 'eenmalige herinnering' ELSE 'herinneringsmail' END,
        'op', n.created_at, 'status', n.status, 'fout', n.error_message, 'resend_id', n.resend_message_id) ORDER BY n.created_at)
       FROM lead_notification_log n WHERE n.lead_type = 'afhaak_herinnering' AND n.metadata->>'concept_id' = c.id::text), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('soort', a.soort, 'tekst', a.tekst, 'op', a.op, 'door', a.door_naam, 'in_tijdlijn', a.crm_notitie_id IS NOT NULL) ORDER BY a.op)
       FROM afhaker_contacten a WHERE a.concept_id = c.id), '[]'::jsonb),
    l.id, l.created_at
  FROM aanvraag_concepten c
  LEFT JOIN LATERAL (SELECT l2.id, l2.created_at FROM leads l2 WHERE l2.type = 'verzekering_aanvraag' AND NOT l2.is_test AND l2.created_at >= c.created_at
      AND (l2.id = c.lead_id OR (c.email IS NOT NULL AND lower(btrim(l2.email)) = lower(btrim(c.email)))
        OR (nullif(regexp_replace(coalesce(c.kvk,''),'\D','','g'),'') IS NOT NULL AND regexp_replace(coalesce(l2.kvk_nummer,''),'\D','','g') = regexp_replace(c.kvk,'\D','','g')))
      ORDER BY l2.created_at LIMIT 1) l ON true
  WHERE c.id = ANY(coalesce(_ids,'{}'));
END $function$;
REVOKE ALL ON FUNCTION public.afhakers_overzicht(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.afhakers_overzicht(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.afhakers_automatisch_afronden()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  UPDATE aanvraag_concepten SET status = 'afgerond_na_herinnering', afgerond_op = now()
   WHERE status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL
     AND herinnering_verstuurd_op IS NOT NULL AND herinnering_verstuurd_op <= now() - interval '7 days'
     AND contact_vastgelegd_op IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO activiteiten_log (actie_type, omschrijving, is_test)
    VALUES ('afhakers_afgerond', n || ' afgehaakte aanvragen automatisch afgerond na herinnering (7 dagen, geen contact vastgelegd).', false);
  END IF;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.afhakers_automatisch_afronden() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.afhakers_automatisch_afronden() TO service_role;

SELECT cron.schedule('afhakers-automatisch-afronden', '20 5 * * *', $$SELECT public.afhakers_automatisch_afronden()$$);

-- E. Tellers (menu en Vandaag te doen): alleen afhakers die nog een handeling van Ellen vragen.
DO $do$
DECLARE f text; d text;
  oud text := 'status = ''open'' AND lead_id IS NULL AND geanonimiseerd_op IS NULL';
  nieuw text := 'status = ''open'' AND lead_id IS NULL AND geanonimiseerd_op IS NULL AND herinnering_verstuurd_op IS NULL AND gezien_op IS NULL AND contact_vastgelegd_op IS NULL';
BEGIN
  FOREACH f IN ARRAY ARRAY['menu_tellers','mijn_acties_vandaag_basis'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname = f AND p.pronamespace = 'public'::regnamespace;
    IF d IS NULL OR (length(d) - length(replace(d, oud, ''))) / length(oud) <> 1 THEN RAISE EXCEPTION 'afhakerregel in % niet eenduidig gevonden', f; END IF;
    EXECUTE replace(d, oud, nieuw);
  END LOOP;
END $do$;
