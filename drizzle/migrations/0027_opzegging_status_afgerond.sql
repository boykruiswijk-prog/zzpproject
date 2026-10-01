CREATE OR REPLACE FUNCTION public.verwerk_opzegging(_aanvraag_id uuid, _contract_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.klant_service_aanvragen; v_datum date; r record; n int := 0;
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
    n := n + 1;
  END LOOP;
  IF n <> array_length(_contract_ids,1) THEN RAISE EXCEPTION 'niet alle contractregels gevonden'; END IF;
  UPDATE public.klant_service_aanvragen SET opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(),
    status = CASE WHEN status IN ('nieuw','in_behandeling') THEN 'afgerond' ELSE status END WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'regels', n, 'einddatum', v_datum);
END $$;
REVOKE ALL ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) TO authenticated;