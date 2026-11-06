CREATE OR REPLACE FUNCTION public.lidmaatschap_credit_reden() RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT 'Besluit Boy 6-11-2026: lidmaatschappen worden niet gecrediteerd'::text $$;

-- Vangnet: elke nieuwe creditrij van een lidmaatschap wordt niet_crediteren; nooit naar te_maken/goedgekeurd/Exact.
CREATE OR REPLACE FUNCTION public.guard_lidmaatschap_geen_credit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_type text;
BEGIN
  SELECT type INTO v_type FROM public.klant_contracten WHERE id = NEW.klant_contract_id;
  IF v_type IS DISTINCT FROM 'lidmaatschap' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'niet_crediteren'; NEW.bedrag := NULL; NEW.beoordeling_reden := public.lidmaatschap_credit_reden();
    NEW.beoordeeld_door := NULL; NEW.beoordeeld_door_naam := 'systeem'; NEW.beoordeeld_op := coalesce(NEW.beoordeeld_op, now());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('te_maken','goedgekeurd','geclaimd','concept_aangemaakt','te_laat','verwerkt') THEN
    RAISE EXCEPTION 'Een lidmaatschap krijgt nooit een creditnota (besluit Boy 6-11-2026). Status % is niet toegestaan.', NEW.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_lidmaatschap_geen_credit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_lidmaatschap_geen_credit ON public.factuur_credit_planning;
CREATE TRIGGER trg_lidmaatschap_geen_credit BEFORE INSERT OR UPDATE OF status ON public.factuur_credit_planning
  FOR EACH ROW EXECUTE FUNCTION public.guard_lidmaatschap_geen_credit();

CREATE OR REPLACE FUNCTION public.plan_opzeg_credit(_contract_id uuid, _aanvraag_id uuid, _einddatum date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k public.klant_contracten; o public.ondernemingen; v_ids uuid[]; v_concept int; v_nr text; v_tm date;
  v_status text; v_melding text; v_bestaand public.factuur_credit_planning; v_bron text := 'planner';
  m public.factuur_artikel_mapping; v_item text; v_gl text; v_waarsch text[];
BEGIN
  SELECT * INTO k FROM public.klant_contracten WHERE id = _contract_id;
  -- Cyber (elke versie, maand of jaar): per dag opzegbaar, nooit creditnota. Bestaande rijen blijven ongemoeid.
  IF k.product LIKE 'cyber%' THEN
    RETURN jsonb_build_object('status','niet_nodig','melding','Cyber: per dag opzegbaar, nooit creditnota (besluit 15-10-2026)');
  END IF;
  -- Maandpolis: per dag opzegbaar, geen creditnota. Bestaande rijen blijven ongemoeid.
  IF k.cyclus = 'maand' THEN
    RETURN jsonb_build_object('status','niet_nodig','melding','Maandpolis: per dag opzegbaar, geen creditnota (besluit 15-10-2026)');
  END IF;
  -- D1-aanvulling (Boy 6-11-2026): lidmaatschappen nooit crediteren. Bestaande rijen blijven ongemoeid.
  IF k.type = 'lidmaatschap' THEN
    SELECT * INTO v_bestaand FROM public.factuur_credit_planning WHERE klant_contract_id = _contract_id AND aanvraag_id IS NOT DISTINCT FROM _aanvraag_id;
    IF v_bestaand.id IS NOT NULL THEN RETURN jsonb_build_object('status', v_bestaand.status, 'bestaand', true); END IF;
    SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;
    INSERT INTO public.factuur_credit_planning (klant_contract_id, aanvraag_id, einddatum, planning_ids, credit_vanaf, credit_tm, creditsleutel,
        status, melding, exact_account_id, is_test, bron, bedrag, beoordeling_reden, beoordeeld_door, beoordeeld_door_naam, beoordeeld_op)
    VALUES (_contract_id, _aanvraag_id, _einddatum, '{}', _einddatum + 1, greatest(coalesce(k.gefactureerd_tm, _einddatum + 1), _einddatum + 1),
        'ZPC-' || upper(substr(md5(_contract_id::text || coalesce(_aanvraag_id::text,'')), 1, 8)), 'niet_crediteren', NULL, o.exact_account_id,
        coalesce(k.is_test,false) OR coalesce(o.is_test,false), 'planner', NULL, public.lidmaatschap_credit_reden(), NULL, 'systeem', now())
    ON CONFLICT (klant_contract_id, aanvraag_id) DO NOTHING;
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
    VALUES ('klant_contracten', _contract_id, 'creditnota_niet_crediteren', 'factuur_credit_planning.status', NULL, 'niet_crediteren', NULL,
      jsonb_build_object('aanvraag_id', _aanvraag_id, 'einddatum', _einddatum, 'reden', public.lidmaatschap_credit_reden(), 'door_naam', 'systeem'));
    RETURN jsonb_build_object('status','niet_crediteren','melding', public.lidmaatschap_credit_reden());
  END IF;
  -- D1 jaarpolis, wacht op Boy: crediteren blijft zoals in D1 tot Boy anders besluit.
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
