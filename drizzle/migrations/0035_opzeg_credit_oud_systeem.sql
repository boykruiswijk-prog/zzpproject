ALTER TABLE public.factuur_credit_planning
  ADD COLUMN IF NOT EXISTS bron text NOT NULL DEFAULT 'planner',
  ADD COLUMN IF NOT EXISTS exact_item_id text,
  ADD COLUMN IF NOT EXISTS gl_code text;
ALTER TABLE public.factuur_credit_planning DROP CONSTRAINT IF EXISTS factuur_credit_planning_status_check;
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_status_check CHECK (status = ANY (ARRAY['te_maken','concept_niet_verwerkt','geen_planner_factuur','geblokkeerd','geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout']));
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_bron_check CHECK (bron IN ('planner','oud_systeem'));
-- Aparte schakelaar voor creditnota's bij opzegging (los van facturatie_actief). Staat UIT tot Boy de dry-run heeft gecontroleerd.
ALTER TABLE public.facturatie_config ADD COLUMN IF NOT EXISTS opzeg_credits_actief boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.plan_opzeg_credit(_contract_id uuid, _aanvraag_id uuid, _einddatum date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k public.klant_contracten; o public.ondernemingen; v_ids uuid[]; v_concept int; v_nr text; v_tm date;
  v_status text; v_melding text; v_bestaand public.factuur_credit_planning; v_bron text := 'planner';
  m public.factuur_artikel_mapping; v_item text; v_gl text;
BEGIN
  SELECT * INTO k FROM public.klant_contracten WHERE id = _contract_id;
  SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;
  SELECT * INTO v_bestaand FROM public.factuur_credit_planning WHERE klant_contract_id = _contract_id AND aanvraag_id = _aanvraag_id;
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
      -- Gefactureerd in het oude systeem: creditnota op basis van contractgegevens.
      v_bron := 'oud_systeem'; v_tm := k.gefactureerd_tm;
      m := public.factuur_mapping_voor(k.itemcode);
      IF m.id IS NULL OR NOT m.bevestigd OR m.exact_item_id IS NULL OR m.blokkade_reden IS NOT NULL THEN
        v_status := 'geblokkeerd';
        v_melding := 'geen bevestigde artikelmapping voor ' || coalesce(k.itemcode,'?') || coalesce(' (' || m.blokkade_reden || ')','');
      ELSIF o.exact_account_id IS NULL THEN
        v_status := 'geblokkeerd'; v_melding := 'relatie niet gekoppeld aan Exact';
      ELSE
        v_status := 'te_maken'; v_item := m.exact_item_id; v_gl := m.gl_code;
        v_melding := 'oorspronkelijk gefactureerd vóór 17-10-2026 (oud systeem)';
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
  INSERT INTO public.factuur_credit_planning (klant_contract_id, aanvraag_id, einddatum, planning_ids, origineel_factuurnummer,
      credit_vanaf, credit_tm, creditsleutel, status, melding, exact_account_id, is_test, bron, exact_item_id, gl_code)
  VALUES (_contract_id, _aanvraag_id, _einddatum, coalesce(v_ids,'{}'), v_nr, _einddatum + 1, v_tm,
      'ZPC-' || upper(substr(md5(_contract_id::text || _aanvraag_id::text), 1, 8)), v_status, v_melding, o.exact_account_id, k.is_test OR o.is_test,
      v_bron, v_item, v_gl)
  ON CONFLICT (klant_contract_id, aanvraag_id) DO UPDATE SET planning_ids = EXCLUDED.planning_ids,
      origineel_factuurnummer = EXCLUDED.origineel_factuurnummer, credit_tm = EXCLUDED.credit_tm,
      status = EXCLUDED.status, melding = EXCLUDED.melding, exact_account_id = EXCLUDED.exact_account_id,
      bron = EXCLUDED.bron, exact_item_id = EXCLUDED.exact_item_id, gl_code = EXCLUDED.gl_code;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klant_contracten', _contract_id, 'creditnota_gepland', 'factuur_credit_planning.status',
    v_bestaand.status, v_status, auth.uid(), jsonb_build_object('aanvraag_id', _aanvraag_id, 'einddatum', _einddatum, 'melding', v_melding, 'bron', v_bron));
  RETURN jsonb_build_object('status', v_status, 'melding', v_melding, 'bron', v_bron);
END $function$;

CREATE OR REPLACE FUNCTION public.herbeoordeel_opzeg_credits()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  FOR r IN SELECT * FROM public.factuur_credit_planning WHERE status IN ('concept_niet_verwerkt','te_maken','geen_planner_factuur','geblokkeerd') LOOP
    PERFORM public.plan_opzeg_credit(r.klant_contract_id, r.aanvraag_id, r.einddatum); n := n + 1;
  END LOOP;
  RETURN n;
END $function$;