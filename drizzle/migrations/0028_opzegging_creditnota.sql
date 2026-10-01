CREATE TABLE public.factuur_credit_planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klant_contract_id uuid NOT NULL REFERENCES public.klant_contracten(id),
  aanvraag_id uuid NOT NULL REFERENCES public.klant_service_aanvragen(id),
  einddatum date NOT NULL,
  planning_ids uuid[] NOT NULL DEFAULT '{}',
  origineel_factuurnummer text,
  credit_vanaf date NOT NULL,
  credit_tm date NOT NULL,
  bedrag numeric,
  berekening jsonb,
  creditsleutel text NOT NULL UNIQUE CHECK (creditsleutel ~ '^ZPC-[0-9A-F]{8}$'),
  status text NOT NULL DEFAULT 'te_maken' CHECK (status IN ('te_maken','concept_niet_verwerkt','geen_planner_factuur','geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout')),
  melding text,
  exact_account_id text,
  exact_invoice_id text,
  exact_invoice_number text,
  exact_status smallint,
  foutmelding text,
  concept_op timestamptz,
  verwerkt_op timestamptz,
  laatst_gecontroleerd_op timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  UNIQUE (klant_contract_id, aanvraag_id)
);
GRANT SELECT ON public.factuur_credit_planning TO authenticated;
GRANT ALL ON public.factuur_credit_planning TO service_role;
ALTER TABLE public.factuur_credit_planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest creditplanning" ON public.factuur_credit_planning FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid()));

-- Bepaalt (opnieuw) of een creditnota nodig/mogelijk is. Bedrag wordt in de planner berekend met polisProRata.
CREATE OR REPLACE FUNCTION public.plan_opzeg_credit(_contract_id uuid, _aanvraag_id uuid, _einddatum date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.klant_contracten; o public.ondernemingen; v_ids uuid[]; v_concept int; v_nr text; v_tm date;
  v_status text; v_melding text; v_bestaand public.factuur_credit_planning;
BEGIN
  SELECT * INTO k FROM public.klant_contracten WHERE id = _contract_id;
  SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;
  SELECT * INTO v_bestaand FROM public.factuur_credit_planning WHERE klant_contract_id = _contract_id AND aanvraag_id = _aanvraag_id;
  IF v_bestaand.id IS NOT NULL AND v_bestaand.status NOT IN ('te_maken','concept_niet_verwerkt','geen_planner_factuur') THEN
    RETURN jsonb_build_object('status', v_bestaand.status, 'bestaand', true);
  END IF;
  -- Planner-facturen die (deels) na de einddatum vallen
  SELECT array_agg(id ORDER BY periode_start), max(periode_eind),
         count(*) FILTER (WHERE status IN ('geclaimd','concept_aangemaakt','te_laat'))
    INTO v_ids, v_tm, v_concept
    FROM public.factuur_planning
   WHERE klant_contract_id = _contract_id AND periode_eind > _einddatum
     AND status IN ('geclaimd','concept_aangemaakt','te_laat','verwerkt');
  IF coalesce(array_length(v_ids,1),0) = 0 THEN
    IF k.gefactureerd_tm IS NOT NULL AND k.gefactureerd_tm > _einddatum THEN
      v_status := 'geen_planner_factuur'; v_tm := k.gefactureerd_tm;
      v_melding := 'gefactureerd t/m ' || to_char(k.gefactureerd_tm,'DD-MM-YYYY') || ' buiten de planner (vóór 17-10-2026): geen factuurnummer bekend, handmatig beoordelen';
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
      credit_vanaf, credit_tm, creditsleutel, status, melding, exact_account_id, is_test)
  VALUES (_contract_id, _aanvraag_id, _einddatum, coalesce(v_ids,'{}'), v_nr, _einddatum + 1, v_tm,
      'ZPC-' || upper(substr(md5(_contract_id::text || _aanvraag_id::text), 1, 8)), v_status, v_melding, o.exact_account_id, k.is_test OR o.is_test)
  ON CONFLICT (klant_contract_id, aanvraag_id) DO UPDATE SET planning_ids = EXCLUDED.planning_ids,
      origineel_factuurnummer = EXCLUDED.origineel_factuurnummer, credit_tm = EXCLUDED.credit_tm,
      status = EXCLUDED.status, melding = EXCLUDED.melding, exact_account_id = EXCLUDED.exact_account_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klant_contracten', _contract_id, 'creditnota_gepland', 'factuur_credit_planning.status',
    v_bestaand.status, v_status, auth.uid(), jsonb_build_object('aanvraag_id', _aanvraag_id, 'einddatum', _einddatum, 'melding', v_melding));
  RETURN jsonb_build_object('status', v_status, 'melding', v_melding);
END $$;
REVOKE ALL ON FUNCTION public.plan_opzeg_credit(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_opzeg_credit(uuid, uuid, date) TO service_role;

-- Planner: geblokkeerde credits opnieuw beoordelen (bv. nadat Roxy het concept verwerkte)
CREATE OR REPLACE FUNCTION public.herbeoordeel_opzeg_credits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  FOR r IN SELECT * FROM public.factuur_credit_planning WHERE status IN ('concept_niet_verwerkt','te_maken') LOOP
    PERFORM public.plan_opzeg_credit(r.klant_contract_id, r.aanvraag_id, r.einddatum); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.herbeoordeel_opzeg_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.herbeoordeel_opzeg_credits() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verwerk_opzegging(_aanvraag_id uuid, _contract_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.klant_service_aanvragen; v_datum date; r record; n int := 0; credits jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'opzeggen' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'opzegging niet gevonden'; END IF;
  IF a.opzegging_verwerkt_op IS NOT NULL THEN RAISE EXCEPTION 'opzegging is al verwerkt'; END IF;
  IF a.onderneming_id IS NULL OR a.koppeling_status <> 'zeker' THEN RAISE EXCEPTION 'bevestig eerst de koppeling met de klant'; END IF;
  IF coalesce(array_length(_contract_ids,1),0) = 0 THEN RAISE EXCEPTION 'kies minstens één contractregel'; END IF;
  BEGIN v_datum := (a.details->>'opzegdatum')::date; EXCEPTION WHEN OTHERS THEN v_datum := NULL; END;
  IF v_datum IS NULL THEN RAISE EXCEPTION 'opzegging heeft geen geldige opzegdatum'; END IF;
  IF v_datum < (a.created_at AT TIME ZONE 'Europe/Amsterdam')::date
     OR v_datum > (a.created_at AT TIME ZONE 'Europe/Amsterdam')::date + 180 THEN
    RAISE EXCEPTION 'opzegdatum valt buiten de toegestane termijn';
  END IF;
  FOR r IN SELECT * FROM public.klant_contracten WHERE id = ANY(_contract_ids) FOR UPDATE LOOP
    IF r.onderneming_id <> a.onderneming_id THEN RAISE EXCEPTION 'contractregel hoort niet bij deze klant'; END IF;
    IF r.status NOT IN ('actief','loopt_af') THEN RAISE EXCEPTION 'contractregel % is niet actief', r.bron_rij; END IF;
    UPDATE public.klant_contracten SET eind_datum = v_datum, status = 'loopt_af',
      afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(v_datum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(v_datum,'DD-MM-YYYY'))
     WHERE id = r.id;
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('klant_contracten', r.id, 'opzegging_verwerken', 'eind_datum/status',
      coalesce(r.eind_datum::text,'—') || ' / ' || r.status, v_datum::text || ' / loopt_af',
      auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('aanvraag_id', a.id, 'bron_rij', r.bron_rij));
    credits := credits || jsonb_build_object('bron_rij', r.bron_rij) || public.plan_opzeg_credit(r.id, a.id, v_datum);
    n := n + 1;
  END LOOP;
  IF n <> array_length(_contract_ids,1) THEN RAISE EXCEPTION 'niet alle contractregels gevonden'; END IF;
  UPDATE public.klant_service_aanvragen SET opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(),
    status = CASE WHEN status IN ('nieuw','in_behandeling') THEN 'afgerond' ELSE status END WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'regels', n, 'einddatum', v_datum, 'credits', credits);
END $$;
REVOKE ALL ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) TO authenticated;