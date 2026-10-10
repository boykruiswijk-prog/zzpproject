ALTER TABLE public.factuur_credit_planning
  ADD COLUMN IF NOT EXISTS opzeg_toelichting text,
  ADD COLUMN IF NOT EXISTS beoordeeld_door uuid,
  ADD COLUMN IF NOT EXISTS beoordeeld_door_naam text,
  ADD COLUMN IF NOT EXISTS beoordeeld_op timestamptz,
  ADD COLUMN IF NOT EXISTS beoordeling_reden text,
  ADD COLUMN IF NOT EXISTS waarschuwingen text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.factuur_credit_planning DROP CONSTRAINT factuur_credit_planning_status_check;
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_status_check CHECK (status = ANY (ARRAY[
  'te_maken','concept_niet_verwerkt','geen_planner_factuur','geblokkeerd','geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout','wacht_op_akkoord','niet_crediteren']));

-- Waarschuwingen (niet blokkerend) voor een creditnota.
CREATE OR REPLACE FUNCTION public.credit_waarschuwingen(_contract_id uuid, _einddatum date)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN k.begin_datum IS NOT NULL AND _einddatum + 1 < k.begin_datum THEN 'Creditperiode begint vóór de begindatum van het contract (' || to_char(k.begin_datum,'DD-MM-YYYY') || ')' END,
    CASE WHEN coalesce(k.gefactureerd_tm_bron,'') LIKE 'doorrol%' THEN 'Gefactureerd-tot komt uit de doorrol, de periode is mogelijk nooit echt gefactureerd' END,
    CASE WHEN _einddatum < (now() AT TIME ZONE 'Europe/Amsterdam')::date - 60 THEN 'Opzegdatum ligt meer dan 60 dagen terug, mogelijk al in AFAS gecrediteerd' END
  ], NULL)
  FROM public.klant_contracten k WHERE k.id = _contract_id
$$;
REVOKE ALL ON FUNCTION public.credit_waarschuwingen(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_waarschuwingen(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.plan_opzeg_credit(_contract_id uuid, _aanvraag_id uuid, _einddatum date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k public.klant_contracten; o public.ondernemingen; v_ids uuid[]; v_concept int; v_nr text; v_tm date;
  v_status text; v_melding text; v_bestaand public.factuur_credit_planning; v_bron text := 'planner';
  m public.factuur_artikel_mapping; v_item text; v_gl text; v_waarsch text[];
BEGIN
  SELECT * INTO k FROM public.klant_contracten WHERE id = _contract_id;
  IF k.cyber_voorwaarden_versie = '2026-10-08' AND k.product = 'cyber_clear' THEN
    RETURN jsonb_build_object('status','niet_nodig','melding','Cyber loopt door tot einde cyberjaar; geen tussentijdse creditnota');
  END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;
  SELECT * INTO v_bestaand FROM public.factuur_credit_planning WHERE klant_contract_id = _contract_id AND aanvraag_id = _aanvraag_id;
  -- wacht_op_akkoord en niet_crediteren worden nooit overschreven.
  IF v_bestaand.id IS NOT NULL AND v_bestaand.status NOT IN ('te_maken','concept_niet_verwerkt','geen_planner_factuur','geblokkeerd') THEN
    RETURN jsonb_build_object('status', v_bestaand.status, 'bestaand', true);
  END IF;
  SELECT array_agg(id ORDER BY periode_start), max(periode_eind),
         count(*) FILTER (WHERE status IN ('geclaimd','concept_aangemaakt','te_laat'))
    INTO v_ids, v_tm, v_concept
    FROM public.factuur_planning
   WHERE klant_contract_id = _contract_id AND periode_eind > _einddatum
     AND status IN ('geclaimd','concept_aangemaakt','te_laat','verwerkt');
  IF coalesce(array_length(v_ids,1),0) = 0 THEN
    IF k.gefactureerd_tm IS NOT NULL AND k.gefactureerd_tm > _einddatum THEN
      v_bron := 'oud_systeem'; v_tm := k.gefactureerd_tm;
      m := public.factuur_mapping_voor(k.itemcode);
      IF m.id IS NULL OR NOT m.bevestigd OR m.exact_item_id IS NULL OR m.blokkade_reden IS NOT NULL THEN
        v_status := 'geblokkeerd';
        v_melding := 'geen bevestigde artikelmapping voor ' || coalesce(k.itemcode,'?') || coalesce(' (' || m.blokkade_reden || ')','');
      ELSIF o.exact_account_id IS NULL THEN
        v_status := 'geblokkeerd'; v_melding := 'relatie niet gekoppeld aan Exact';
      ELSE
        v_status := 'te_maken'; v_item := m.exact_item_id; v_gl := m.gl_code;
        v_melding := 'oorspronkelijk gefactureerd vóór 13-10-2026 (oud systeem)';
      END IF;
    ELSE
      RETURN jsonb_build_object('status', 'niet_nodig');
    END IF;
  ELSIF v_concept > 0 THEN
    v_status := 'concept_niet_verwerkt';
    v_melding := 'concept nog niet verwerkt — pas eerst het concept aan of verwijder het in Exact';
  ELSE
    v_status := 'te_maken'; v_melding := NULL;
    SELECT exact_invoice_number INTO v_nr FROM public.factuur_planning WHERE id = v_ids[1];
  END IF;
  -- Alleen een expliciete goedkeuring (beoordeeld_op) levert te_maken op; anders eerst akkoord Ellen.
  IF v_status = 'te_maken' AND NOT (v_bestaand.id IS NOT NULL AND v_bestaand.status = 'te_maken' AND v_bestaand.beoordeeld_op IS NOT NULL) THEN
    v_status := 'wacht_op_akkoord';
  END IF;
  v_waarsch := public.credit_waarschuwingen(_contract_id, _einddatum);
  INSERT INTO public.factuur_credit_planning (klant_contract_id, aanvraag_id, einddatum, planning_ids, origineel_factuurnummer,
      credit_vanaf, credit_tm, creditsleutel, status, melding, exact_account_id, is_test, bron, exact_item_id, gl_code, waarschuwingen)
  VALUES (_contract_id, _aanvraag_id, _einddatum, coalesce(v_ids,'{}'), v_nr, _einddatum + 1, v_tm,
      'ZPC-' || upper(substr(md5(_contract_id::text || _aanvraag_id::text), 1, 8)), v_status, v_melding, o.exact_account_id, k.is_test OR o.is_test,
      v_bron, v_item, v_gl, coalesce(v_waarsch,'{}'))
  ON CONFLICT (klant_contract_id, aanvraag_id) DO UPDATE SET planning_ids = EXCLUDED.planning_ids,
      origineel_factuurnummer = EXCLUDED.origineel_factuurnummer, credit_tm = EXCLUDED.credit_tm,
      status = EXCLUDED.status, melding = EXCLUDED.melding, exact_account_id = EXCLUDED.exact_account_id,
      bron = EXCLUDED.bron, exact_item_id = EXCLUDED.exact_item_id, gl_code = EXCLUDED.gl_code, waarschuwingen = EXCLUDED.waarschuwingen;
  IF v_bestaand.status IS DISTINCT FROM v_status THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
    VALUES ('klant_contracten', _contract_id, 'creditnota_gepland', 'factuur_credit_planning.status',
      v_bestaand.status, v_status, auth.uid(), jsonb_build_object('aanvraag_id', _aanvraag_id, 'einddatum', _einddatum, 'melding', v_melding, 'bron', v_bron, 'waarschuwingen', v_waarsch));
  END IF;
  RETURN jsonb_build_object('status', v_status, 'melding', v_melding, 'bron', v_bron, 'waarschuwingen', to_jsonb(v_waarsch));
END $function$;

-- Voorstel voor de dialoog: contractgegevens en gefactureerde perioden; bedrag rekent de UI met berekenOudSysteemCredit/berekenOpzegCredit.
CREATE OR REPLACE FUNCTION public.credit_voorstel(_contract_id uuid, _einddatum date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k public.klant_contracten; per jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO k FROM public.klant_contracten WHERE id = _contract_id;
  IF k.id IS NULL THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('periode_start', periode_start, 'periode_eind', periode_eind, 'bedrag', bedrag) ORDER BY periode_start), '[]')
    INTO per FROM public.factuur_planning
   WHERE klant_contract_id = _contract_id AND periode_eind > _einddatum AND status IN ('geclaimd','concept_aangemaakt','te_laat','verwerkt');
  RETURN jsonb_build_object('cyclus', k.cyclus, 'aantal', k.aantal, 'bedrag_per_periode', k.bedrag_per_periode, 'begin_datum', k.begin_datum,
    'factureren_vanaf', k.factureren_vanaf, 'gefactureerd_tm', k.gefactureerd_tm, 'product', k.product,
    'cyber_geen_credit', (k.cyber_voorwaarden_versie = '2026-10-08' AND k.product = 'cyber_clear'),
    'planner_perioden', per, 'waarschuwingen', to_jsonb(public.credit_waarschuwingen(_contract_id, _einddatum)));
END $$;
REVOKE ALL ON FUNCTION public.credit_voorstel(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_voorstel(uuid, date) TO authenticated;

-- Nieuwe variant met verplichte creditkeuze. De oude 4-argumentenvariant blijft bestaan (credit gaat dan naar wacht_op_akkoord).
CREATE OR REPLACE FUNCTION public.einddatum_controle_beslissen(_contract_id uuid, _keuze text, _opzegdatum date, _toelichting text, _crediteren boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb; v_aid uuid; v_naam text; c public.factuur_credit_planning;
BEGIN
  IF _keuze = 'opzegging' AND _crediteren IS NULL THEN RAISE EXCEPTION 'kies of er een creditnota moet komen'; END IF;
  res := public.einddatum_controle_beslissen(_contract_id, _keuze, _opzegdatum, _toelichting);
  IF _keuze <> 'opzegging' THEN RETURN res; END IF;
  v_aid := (res->'beeindiging'->>'aanvraag_id')::uuid;
  SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO c FROM public.factuur_credit_planning WHERE klant_contract_id = _contract_id AND aanvraag_id = v_aid FOR UPDATE;
  IF c.id IS NULL THEN RETURN res || jsonb_build_object('credit', 'geen creditnota nodig'); END IF;
  UPDATE public.factuur_credit_planning SET opzeg_toelichting = btrim(_toelichting) WHERE id = c.id;
  IF NOT _crediteren AND c.status IN ('wacht_op_akkoord','geblokkeerd','concept_niet_verwerkt','geen_planner_factuur') THEN
    UPDATE public.factuur_credit_planning SET status = 'niet_crediteren', beoordeling_reden = btrim(_toelichting),
      beoordeeld_door = auth.uid(), beoordeeld_door_naam = v_naam, beoordeeld_op = now() WHERE id = c.id;
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('klant_contracten', _contract_id, 'creditnota_niet_crediteren', 'factuur_credit_planning.status', c.status, 'niet_crediteren',
      auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('credit_id', c.id, 'creditsleutel', c.creditsleutel, 'reden', btrim(_toelichting), 'door_naam', v_naam, 'via', 'opzegging_bevestigen'));
    RETURN res || jsonb_build_object('credit', 'niet_crediteren');
  END IF;
  RETURN res || jsonb_build_object('credit', c.status);
END $$;
REVOKE ALL ON FUNCTION public.einddatum_controle_beslissen(uuid, text, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.einddatum_controle_beslissen(uuid, text, date, text, boolean) TO authenticated;

-- Lijst "Creditnota's ter goedkeuring".
CREATE OR REPLACE FUNCTION public.credits_ter_goedkeuring(_toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status, 'creditsleutel', c.creditsleutel, 'bron', c.bron, 'einddatum', c.einddatum,
    'credit_vanaf', c.credit_vanaf, 'credit_tm', c.credit_tm, 'bedrag', c.bedrag, 'melding', c.melding, 'foutmelding', c.foutmelding, 'is_test', c.is_test,
    'onderneming_id', o.id, 'klant', o.naam, 'relatiecode', o.exact_relatie_code, 'product', k.product, 'itemcode', k.itemcode, 'abonnement_nr', k.abonnement_nr,
    'contract', jsonb_build_object('cyclus', k.cyclus, 'aantal', k.aantal, 'bedrag_per_periode', k.bedrag_per_periode, 'begin_datum', k.begin_datum, 'factureren_vanaf', k.factureren_vanaf, 'gefactureerd_tm', k.gefactureerd_tm),
    'planner_perioden', (SELECT coalesce(jsonb_agg(jsonb_build_object('periode_start', p.periode_start, 'periode_eind', p.periode_eind, 'bedrag', p.bedrag) ORDER BY p.periode_start), '[]') FROM public.factuur_planning p WHERE p.id = ANY(c.planning_ids)),
    'toelichting', coalesce(c.opzeg_toelichting,
       (SELECT l.details->>'toelichting' FROM public.sensitive_audit_log l WHERE l.target_id = c.klant_contract_id AND l.details ? 'toelichting' ORDER BY l.created_at DESC LIMIT 1),
       (SELECT coalesce(a.details->>'verwerkt_toelichting', a.details->>'toelichting') FROM public.klant_service_aanvragen a WHERE a.id = c.aanvraag_id)),
    'waarschuwingen', to_jsonb(public.credit_waarschuwingen(c.klant_contract_id, c.einddatum))
  ) ORDER BY c.aangemaakt_op)
  FROM public.factuur_credit_planning c
  JOIN public.klant_contracten k ON k.id = c.klant_contract_id
  LEFT JOIN public.ondernemingen o ON o.id = k.onderneming_id
  WHERE (c.status = 'wacht_op_akkoord' OR (c.status = 'fout' AND c.foutmelding LIKE 'IN DE WACHT 10-10%'))
    AND (_toon_test OR NOT c.is_test)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.credits_ter_goedkeuring(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credits_ter_goedkeuring(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.credit_beoordelen(_id uuid, _goedkeuren boolean, _reden text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.factuur_credit_planning; v_naam text; v_nieuw text;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _goedkeuren IS NULL THEN RAISE EXCEPTION 'kies goedkeuren of niet crediteren'; END IF;
  SELECT * INTO c FROM public.factuur_credit_planning WHERE id = _id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'creditnota niet gevonden'; END IF;
  IF NOT (c.status = 'wacht_op_akkoord' OR (c.status = 'fout' AND c.foutmelding LIKE 'IN DE WACHT 10-10%')) THEN
    RAISE EXCEPTION 'deze creditnota wacht niet op akkoord (status %)', c.status;
  END IF;
  IF NOT _goedkeuren AND length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'reden is verplicht'; END IF;
  SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
  v_nieuw := CASE WHEN _goedkeuren THEN 'te_maken' ELSE 'niet_crediteren' END;
  UPDATE public.factuur_credit_planning SET status = v_nieuw, beoordeeld_door = auth.uid(), beoordeeld_door_naam = v_naam, beoordeeld_op = now(),
    beoordeling_reden = nullif(btrim(coalesce(_reden,'')),'') WHERE id = c.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_contracten', c.klant_contract_id, CASE WHEN _goedkeuren THEN 'creditnota_goedgekeurd' ELSE 'creditnota_niet_crediteren' END,
    'factuur_credit_planning.status', c.status, v_nieuw, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('credit_id', c.id, 'creditsleutel', c.creditsleutel, 'reden', nullif(btrim(coalesce(_reden,'')),''), 'door_naam', v_naam, 'oude_foutmelding', c.foutmelding));
  RETURN jsonb_build_object('ok', true, 'status', v_nieuw);
END $$;
REVOKE ALL ON FUNCTION public.credit_beoordelen(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_beoordelen(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_tellers()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); fact boolean;
BEGIN
  IF NOT public.is_team_member(me) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  fact := public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie);
  RETURN jsonb_build_object(
    'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag' AND geactiveerd_op IS NULL AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland','offerte_verstuurd')),
    'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag' AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland')),
    'service', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type NOT IN ('opzeggen','portaltoegang') AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'opzeggingen', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type = 'opzeggen' AND opzegging_verwerkt_op IS NULL AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'screening', (SELECT count(*) FROM screening_aanvragen WHERE NOT is_test AND coalesce(status,'nieuw') NOT IN ('afgerond','afgewezen','geannuleerd')),
    'afgehaakt', (SELECT count(*) FROM aanvraag_concepten WHERE NOT is_test AND status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL AND laatst_actief_op >= now() - interval '7 days' AND laatst_actief_op < now() - interval '30 minutes'),
    'chat', (SELECT count(*) FROM chat_sessions s JOIN leads l ON l.id = s.lead_id WHERE NOT s.is_test AND NOT l.is_test AND l.status IN ('nieuw','nieuw_te_beoordelen')),
    'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')) + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'nieuwe_aanvraag_nodig'),
    'credits_akkoord', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND (status = 'wacht_op_akkoord' OR (status = 'fout' AND foutmelding LIKE 'IN DE WACHT 10-10%'))),
    'bav_nakijken', (SELECT count(*) FROM ondernemingen o WHERE NOT o.is_test
      AND EXISTS (SELECT 1 FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron = 'afas_abonnement')
      AND NOT EXISTS (SELECT 1 FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','bevestigd','overgenomen'))
      AND NOT EXISTS (SELECT 1 FROM bav_nummer_nakijken n WHERE n.onderneming_id = o.id)),
    'facturatie', CASE WHEN fact THEN
      (SELECT count(*) FROM leads WHERE NOT is_test AND exact_invoice_id IS NOT NULL AND exact_invoice_number IS NULL AND coalesce(exact_invoice_status,0) <> 50)
      + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'exact_aanpassen') ELSE 0 END
  );
END $function$;