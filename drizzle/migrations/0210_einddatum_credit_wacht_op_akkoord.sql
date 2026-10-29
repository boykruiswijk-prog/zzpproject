CREATE OR REPLACE FUNCTION public.crm_einddatum_wijzigen(_contract_id uuid, _einddatum date, _reden text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.klant_contracten; v_notitie uuid; v_cred int;
BEGIN
  IF NOT (public.is_team_member(auth.uid()) AND public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'reden is verplicht'; END IF;
  SELECT * INTO r FROM public.klant_contracten WHERE id = _contract_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  IF r.eind_datum IS NULL THEN RAISE EXCEPTION 'contract heeft geen einddatum; gebruik Beeindigen'; END IF;
  IF _einddatum IS NULL OR _einddatum > (now() AT TIME ZONE 'Europe/Amsterdam')::date + 366 THEN RAISE EXCEPTION 'ongeldige einddatum'; END IF;
  IF EXISTS (SELECT 1 FROM public.factuur_credit_planning WHERE klant_contract_id = r.id AND status IN ('geclaimd','concept_aangemaakt','verwerkt','te_laat')) THEN
    RAISE EXCEPTION 'er staat al een creditnota in Exact voor dit contract; einddatum niet gewijzigd';
  END IF;
  UPDATE public.klant_contracten SET eind_datum = _einddatum,
    afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(r.eind_datum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY'))
   WHERE id = r.id;
  -- Besluit Boy 29-10 (C-aanvulling): ook een creditregel die op akkoord wacht wordt herberekend.
  -- Status blijft ongewijzigd (wacht_op_akkoord blijft wacht_op_akkoord, nooit automatisch goedgekeurd).
  UPDATE public.factuur_credit_planning SET einddatum = _einddatum, credit_vanaf = _einddatum + 1, bedrag = NULL, berekening = NULL,
    beoordeeld_door = CASE WHEN status = 'wacht_op_akkoord' THEN NULL ELSE beoordeeld_door END,
    beoordeeld_door_naam = CASE WHEN status = 'wacht_op_akkoord' THEN NULL ELSE beoordeeld_door_naam END,
    beoordeeld_op = CASE WHEN status = 'wacht_op_akkoord' THEN NULL ELSE beoordeeld_op END
   WHERE klant_contract_id = r.id AND status IN ('te_maken','geblokkeerd','fout','wacht_op_akkoord');
  GET DIAGNOSTICS v_cred = ROW_COUNT;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_contracten', r.id, 'einddatum_gewijzigd', 'eind_datum', r.eind_datum::text, _einddatum::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('reden', _reden, 'creditregels_bijgewerkt', v_cred));
  v_notitie := public.crm_notitie_toevoegen(r.onderneming_id, NULL, 'stop',
    'Einddatum contractregel ' || r.bron_rij || ' gewijzigd van ' || to_char(r.eind_datum,'DD-MM-YYYY') || ' naar ' || to_char(_einddatum,'DD-MM-YYYY') || E'\nReden: ' || btrim(_reden)
    || CASE WHEN v_cred > 0 THEN E'\nCreditnotavoorstel wordt opnieuw berekend.' ELSE '' END,
    jsonb_build_object('contract_id', r.id, 'oud', r.eind_datum, 'nieuw', _einddatum));
  RETURN jsonb_build_object('ok', true, 'notitie_id', v_notitie, 'creditregels_bijgewerkt', v_cred);
END $function$;