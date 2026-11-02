CREATE OR REPLACE FUNCTION public.onderneming_samenvoegen_intern(_van uuid, _naar uuid, _door uuid, _door_naam text, _reden text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.ondernemingen; n public.ondernemingen; tel jsonb := '{}'::jsonb; c int;
BEGIN
  IF _van IS NULL OR _naar IS NULL OR _van = _naar THEN RAISE EXCEPTION 'kies twee verschillende klantkaarten'; END IF;
  SELECT * INTO v FROM public.ondernemingen WHERE id = _van FOR UPDATE;
  SELECT * INTO n FROM public.ondernemingen WHERE id = _naar FOR UPDATE;
  IF v.id IS NULL OR n.id IS NULL THEN RAISE EXCEPTION 'klantkaart niet gevonden'; END IF;
  IF v.samengevoegd_naar IS NOT NULL OR n.samengevoegd_naar IS NOT NULL THEN RAISE EXCEPTION 'een van beide kaarten is al samengevoegd'; END IF;
  IF v.is_test IS DISTINCT FROM n.is_test THEN RAISE EXCEPTION 'testkaart en echte kaart kunnen niet samen'; END IF;
  IF v.kvk IS NOT NULL AND n.kvk IS NOT NULL AND v.kvk <> n.kvk THEN RAISE EXCEPTION 'KvK-nummers verschillen; gebruik Ondernemingswijziging'; END IF;

  UPDATE public.persoon_onderneming x SET onderneming_id = _naar WHERE x.onderneming_id = _van
    AND NOT EXISTS (SELECT 1 FROM public.persoon_onderneming y WHERE y.onderneming_id = _naar AND y.persoon_id = x.persoon_id);
  GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('persoon_onderneming', c);
  UPDATE public.bav_nummer_bevestigingen x SET onderneming_id = _naar WHERE x.onderneming_id = _van
    AND NOT EXISTS (SELECT 1 FROM public.bav_nummer_bevestigingen y WHERE y.onderneming_id = _naar AND y.nummer = x.nummer);
  GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('bav_nummer_bevestigingen', c);
  UPDATE public.bav_nummer_nakijken SET onderneming_id = _naar WHERE onderneming_id = _van
    AND NOT EXISTS (SELECT 1 FROM public.bav_nummer_nakijken WHERE onderneming_id = _naar);
  UPDATE public.klant_certificaten x SET onderneming_id = _naar WHERE x.onderneming_id = _van
    AND NOT EXISTS (SELECT 1 FROM public.klant_certificaten y WHERE y.onderneming_id = _naar AND y.certificaatnummer = x.certificaatnummer AND y.aanvraagdatum IS NOT DISTINCT FROM x.aanvraagdatum);
  GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klant_certificaten', c);
  UPDATE public.klant_mandaten x SET onderneming_id = _naar WHERE x.onderneming_id = _van
    AND NOT EXISTS (SELECT 1 FROM public.klant_mandaten y WHERE y.onderneming_id = _naar AND y.kenmerk IS NOT DISTINCT FROM x.kenmerk AND y.bron IS NOT DISTINCT FROM x.bron);
  GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klant_mandaten', c);
  UPDATE public.crm_notities SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('crm_notities', c);
  UPDATE public.crm_taken SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('crm_taken', c);
  UPDATE public.klant_contracten SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klant_contracten', c);
  UPDATE public.policies SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('policies', c);
  UPDATE public.klant_service_aanvragen SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klant_service_aanvragen', c);
  UPDATE public.lead_klant_log SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('lead_klant_log', c);
  UPDATE public.klant_vlag_log SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klant_vlag_log', c);
  UPDATE public.klantmail_log SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('klantmail_log', c);
  UPDATE public.prolongatie_log SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('prolongatie_log', c);
  UPDATE public.incasso_mislukt SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('incasso_mislukt', c);
  UPDATE public.cyber_toevoeg_verzoeken SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('cyber_toevoeg_verzoeken', c);
  UPDATE public.nps_antwoorden SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('nps_antwoorden', c);
  UPDATE public.exact_betaalconditie_import SET onderneming_id = _naar WHERE onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('exact_betaalconditie_import', c);
  UPDATE public.leads SET gekoppeld_onderneming_id = _naar WHERE gekoppeld_onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('leads', c);
  UPDATE public.aanvraag_concepten SET gekoppeld_onderneming_id = _naar WHERE gekoppeld_onderneming_id = _van; GET DIAGNOSTICS c = ROW_COUNT; tel := tel || jsonb_build_object('aanvraag_concepten', c);
  UPDATE public.onderneming_opvolging SET van_onderneming_id = _naar WHERE van_onderneming_id = _van AND naar_onderneming_id <> _naar;
  UPDATE public.onderneming_opvolging SET naar_onderneming_id = _naar WHERE naar_onderneming_id = _van AND van_onderneming_id <> _naar;
  UPDATE public.omzetting_beslissingen SET van_onderneming_id = _naar WHERE van_onderneming_id = _van AND naar_onderneming_id IS DISTINCT FROM _naar;
  UPDATE public.omzetting_beslissingen SET naar_onderneming_id = _naar WHERE naar_onderneming_id = _van AND van_onderneming_id IS DISTINCT FROM _naar;

  UPDATE public.ondernemingen SET samengevoegd_naar = _naar, samengevoegd_op = now() WHERE id = _van;

  INSERT INTO public.sensitive_audit_log(target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('ondernemingen', _van, 'klantkaart_samengevoegd', 'samengevoegd_naar', NULL, _naar::text, _door,
          jsonb_build_object('van', _van, 'naar', _naar, 'kvk', coalesce(n.kvk, v.kvk), 'verplaatst', tel, 'reden', _reden));
  INSERT INTO public.crm_notities(onderneming_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
  VALUES (_naar, 'notitie', 'Dubbele klantkaart samengevoegd met deze kaart (' || coalesce(v.naam, 'onbekend') || ', aangemaakt ' || to_char(v.created_at AT TIME ZONE 'Europe/Amsterdam', 'DD-MM-YYYY') || '). Niets verwijderd.' || coalesce(' Reden: ' || nullif(btrim(_reden), ''), ''),
          _door, _door_naam, n.is_test, jsonb_build_object('samengevoegd_van', _van, 'verplaatst', tel));
  RETURN jsonb_build_object('ok', true, 'van', _van, 'naar', _naar, 'verplaatst', tel);
END $$;
REVOKE ALL ON FUNCTION public.onderneming_samenvoegen_intern(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onderneming_samenvoegen_intern(uuid, uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.onderneming_samenvoegen(_van uuid, _naar uuid, _reden text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_naam text;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2'
     OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering')) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
  RETURN public.onderneming_samenvoegen_intern(_van, _naar, auth.uid(), v_naam, _reden);
END $$;
REVOKE ALL ON FUNCTION public.onderneming_samenvoegen(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onderneming_samenvoegen(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dubbele_klanten()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2'
     OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering')) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('kvk', g.kvk, 'kaarten', g.kaarten) ORDER BY g.kvk)
    FROM (
      SELECT o.kvk, jsonb_agg(jsonb_build_object(
        'id', o.id, 'naam', o.naam, 'aangemaakt', o.created_at, 'bron', o.bron,
        'exact_relatie_code', o.exact_relatie_code,
        'actief_contract', EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND NOT k.is_test),
        'contactpersonen', (SELECT count(*) FROM public.persoon_onderneming po WHERE po.onderneming_id = o.id),
        'portaal', EXISTS (SELECT 1 FROM public.policies p LEFT JOIN public.leads l ON l.id = p.lead_id
                           WHERE p.user_id IS NOT NULL AND (p.onderneming_id = o.id OR l.gekoppeld_onderneming_id = o.id)),
        'bav_nummers', (SELECT coalesce(jsonb_agg(DISTINCT b.nummer), '[]'::jsonb) FROM public.crm_bav_nummers b
                        WHERE b.onderneming_id = o.id AND b.nummer IS NOT NULL AND coalesce(b.status,'') <> 'ingetrokken')
      ) ORDER BY o.created_at) kaarten
      FROM public.ondernemingen o
      WHERE o.kvk IS NOT NULL AND o.samengevoegd_naar IS NULL AND NOT o.is_test
      GROUP BY o.kvk HAVING count(*) > 1
    ) g), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.dubbele_klanten() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dubbele_klanten() TO authenticated;

CREATE OR REPLACE FUNCTION public.weiger_dubbele_kvk()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.dubbele_kvk_toegestaan', true), '') = 'on' THEN RETURN NEW; END IF;
  IF NEW.kvk IS NOT NULL AND NOT coalesce(NEW.is_test, false) AND NEW.samengevoegd_naar IS NULL
     AND EXISTS (SELECT 1 FROM public.ondernemingen o WHERE o.kvk = NEW.kvk AND o.samengevoegd_naar IS NULL AND NOT o.is_test AND o.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Er bestaat al een klantkaart met KvK-nummer %; koppel aan die kaart.', NEW.kvk USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_weiger_dubbele_kvk ON public.ondernemingen;
CREATE TRIGGER trg_weiger_dubbele_kvk BEFORE INSERT ON public.ondernemingen FOR EACH ROW EXECUTE FUNCTION public.weiger_dubbele_kvk();

DO $m$
DECLARE d text; oud text; nieuw text;
BEGIN
  d := pg_get_functiondef('public.koppel_bronrecord_aan_persoon'::regproc);
  oud := E'    IF v_ond_id IS NULL THEN\n      INSERT INTO public.ondernemingen(kvk, naam, iban)';
  nieuw := E'    IF v_ond_id IS NULL AND v_kvk IS NOT NULL THEN\n      SELECT o.id INTO v_ond_id FROM public.ondernemingen o\n      WHERE o.kvk = v_kvk AND o.samengevoegd_naar IS NULL AND NOT o.is_test\n      ORDER BY EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = ''actief'') DESC, o.created_at\n      LIMIT 1;\n      IF v_ond_id IS NOT NULL THEN\n        INSERT INTO public.persoon_onderneming(persoon_id, onderneming_id) VALUES (v_person_id, v_ond_id) ON CONFLICT (persoon_id, onderneming_id) DO NOTHING;\n      END IF;\n    END IF;\n\n' || oud;
  IF position(oud in d) = 0 THEN RAISE EXCEPTION 'koppel_bronrecord_aan_persoon niet aangepast'; END IF;
  d := replace(d, oud, nieuw);
  EXECUTE d;
END $m$;