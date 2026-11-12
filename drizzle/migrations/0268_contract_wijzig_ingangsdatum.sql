-- Besluit Boy 12-11-2026 12:00: ingangsdatum van een nog niet gefactureerd contract intern wijzigen. Nooit Exact.
CREATE OR REPLACE FUNCTION public.contract_ingangsdatum_blokkade(p_contract_id uuid, p_nieuwe_datum date DEFAULT NULL, p_reden text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.klant_contracten; vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT public.is_team_member(auth.uid()) AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO c FROM public.klant_contracten WHERE id = p_contract_id;
  IF c.id IS NULL THEN RETURN 'Contract niet gevonden.'; END IF;
  IF c.eind_datum IS NOT NULL THEN RETURN 'Dit contract is beëindigd. De ingangsdatum kan niet meer worden gewijzigd.'; END IF;
  IF c.begin_datum IS NULL THEN RETURN 'Dit contract heeft geen ingangsdatum.'; END IF;
  IF EXISTS (SELECT 1 FROM public.factuur_planning WHERE klant_contract_id = c.id AND status NOT IN ('geannuleerd','fout')) THEN
    RETURN 'Voor dit contract is al een factuur gepland of gemaakt. Wijzig de ingangsdatum via de administratie.'; END IF;
  IF EXISTS (SELECT 1 FROM public.factuur_credit_planning WHERE klant_contract_id = c.id) THEN
    RETURN 'Voor dit contract is al een creditnota gepland. Wijzig de ingangsdatum via de administratie.'; END IF;
  IF c.gefactureerd_tm IS NOT NULL AND c.gefactureerd_tm >= c.begin_datum THEN
    RETURN 'Voor dit contract is al gefactureerd (t/m ' || to_char(c.gefactureerd_tm, 'DD-MM-YYYY') || ').'; END IF;
  IF p_nieuwe_datum IS NOT NULL THEN
    IF p_nieuwe_datum = c.begin_datum THEN RETURN 'De nieuwe ingangsdatum is gelijk aan de huidige.'; END IF;
    IF p_nieuwe_datum > (vandaag + interval '1 year')::date THEN RETURN 'De nieuwe ingangsdatum ligt meer dan 1 jaar in de toekomst.'; END IF;
    IF p_nieuwe_datum < vandaag - 60 THEN RETURN 'De nieuwe ingangsdatum ligt meer dan 60 dagen in het verleden.'; END IF;
  END IF;
  IF p_reden IS NOT NULL AND length(btrim(p_reden)) < 10 THEN RETURN 'Geef een reden van minimaal 10 tekens.'; END IF;
  RETURN NULL;
END $$;

-- Polissen bij een contract: zelfde koppeling als het klantdossier (onderneming of leads via persoon/relatiecode), geldig en met de oude ingangsdatum.
CREATE OR REPLACE FUNCTION public.contract_polissen_bij_ingang(p_contract_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH c AS (SELECT * FROM public.klant_contracten WHERE id = p_contract_id),
  pers AS (SELECT po.persoon_id FROM public.persoon_onderneming po, c WHERE po.onderneming_id = c.onderneming_id),
  ld AS (
    SELECT bron_id AS id FROM public.persoon_bron_koppeling WHERE bron_tabel = 'leads' AND persoon_id IN (SELECT persoon_id FROM pers)
    UNION SELECT l.id FROM public.leads l JOIN public.ondernemingen o ON o.exact_relatie_code = l.exact_relatie_code, c WHERE o.id = c.onderneming_id)
  SELECT p.id FROM public.policies p, c
  WHERE p.status = 'geldig' AND p.start_date = c.begin_datum AND c.product IN ('bav_avb','nimble_bav','cyber_clear')
    AND (p.onderneming_id = c.onderneming_id OR p.lead_id IN (SELECT id FROM ld))
$$;
REVOKE ALL ON FUNCTION public.contract_polissen_bij_ingang(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_polissen_bij_ingang(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_ingangsdatum_info(p_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.klant_contracten; uit jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO c FROM public.klant_contracten WHERE id = p_contract_id;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'blokkade', public.contract_ingangsdatum_blokkade(c.id),
    'begin_datum', c.begin_datum, 'gefactureerd_tm', c.gefactureerd_tm,
    'verstuurde_factuur', EXISTS (SELECT 1 FROM public.factuur_planning WHERE klant_contract_id = c.id AND status NOT IN ('geannuleerd','fout')),
    'polissen', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'certificate_number', p.certificate_number, 'start_date', p.start_date,
        'gemaild_op', (SELECT max(n.created_at) FROM public.lead_notification_log n WHERE n.lead_type = 'certificaat' AND n.status = 'sent' AND p.certificate_number IS NOT NULL AND n.subject ILIKE '%' || p.certificate_number || '%')))
      FROM public.policies p WHERE p.id IN (SELECT public.contract_polissen_bij_ingang(c.id))), '[]'::jsonb)
  ) INTO uit;
  RETURN uit;
END $$;

CREATE OR REPLACE FUNCTION public.contract_wijzig_ingangsdatum(p_contract_id uuid, p_nieuwe_datum date, p_reden text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.klant_contracten; r text := btrim(coalesce(p_reden,'')); fout text; v_pol uuid[]; v_oud jsonb; v_nieuw jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF p_nieuwe_datum IS NULL THEN RAISE EXCEPTION 'Kies een nieuwe ingangsdatum.'; END IF;
  SELECT * INTO c FROM public.klant_contracten WHERE id = p_contract_id FOR UPDATE;
  fout := public.contract_ingangsdatum_blokkade(p_contract_id, p_nieuwe_datum, r);
  IF fout IS NOT NULL THEN RAISE EXCEPTION '%', fout; END IF;
  IF length(r) > 500 THEN RAISE EXCEPTION 'De reden mag maximaal 500 tekens zijn.'; END IF;
  SELECT coalesce(array_agg(x), '{}') INTO v_pol FROM public.contract_polissen_bij_ingang(c.id) x;
  v_oud := jsonb_build_object('begin_datum', c.begin_datum, 'factureren_vanaf', c.factureren_vanaf, 'volgende_factuurdatum', c.volgende_factuurdatum,
    'gefactureerd_tm', c.gefactureerd_tm, 'gefactureerd_tm_bron', c.gefactureerd_tm_bron, 'cyber_ingangsdatum', c.cyber_ingangsdatum);
  UPDATE public.klant_contracten SET
    begin_datum = p_nieuwe_datum,
    factureren_vanaf = p_nieuwe_datum,
    volgende_factuurdatum = CASE WHEN volgende_factuurdatum = c.begin_datum THEN p_nieuwe_datum ELSE volgende_factuurdatum END,
    gefactureerd_tm = p_nieuwe_datum - 1,
    gefactureerd_tm_bron = 'ingangsdatum_gewijzigd',
    cyber_ingangsdatum = CASE WHEN product = 'cyber_clear' THEN p_nieuwe_datum ELSE cyber_ingangsdatum END
  WHERE id = c.id RETURNING jsonb_build_object('begin_datum', begin_datum, 'factureren_vanaf', factureren_vanaf, 'volgende_factuurdatum', volgende_factuurdatum,
    'gefactureerd_tm', gefactureerd_tm, 'gefactureerd_tm_bron', gefactureerd_tm_bron, 'cyber_ingangsdatum', cyber_ingangsdatum) INTO v_nieuw;
  UPDATE public.policies SET start_date = p_nieuwe_datum WHERE id = ANY(v_pol);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_contracten', c.id, 'ingangsdatum_gewijzigd', 'begin_datum', c.begin_datum::text, p_nieuwe_datum::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('reden', r, 'oud', v_oud, 'nieuw', v_nieuw, 'policy_ids', to_jsonb(v_pol)));
  PERFORM public.crm_notitie_toevoegen(c.onderneming_id, NULL, 'notitie',
    'Ingangsdatum gewijzigd van ' || to_char(c.begin_datum, 'DD-MM-YYYY') || ' naar ' || to_char(p_nieuwe_datum, 'DD-MM-YYYY') || E'\nReden: ' || r,
    jsonb_build_object('klant_contract_id', c.id, 'policy_ids', to_jsonb(v_pol)));
  RETURN jsonb_build_object('contract_id', c.id, 'oud', v_oud, 'nieuw', v_nieuw, 'policy_ids', to_jsonb(v_pol));
END $$;

REVOKE ALL ON FUNCTION public.contract_ingangsdatum_blokkade(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_ingangsdatum_blokkade(uuid, date, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.contract_ingangsdatum_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_ingangsdatum_info(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.contract_wijzig_ingangsdatum(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_wijzig_ingangsdatum(uuid, date, text) TO authenticated, service_role;