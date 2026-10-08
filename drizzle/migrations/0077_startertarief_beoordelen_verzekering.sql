CREATE OR REPLACE FUNCTION public.beoordeel_startertarief(_lead_id uuid, _goedkeuren boolean, _toelichting text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.leads; nieuw text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  IF l.starter_controle_status IS DISTINCT FROM 'te_controleren' THEN RAISE EXCEPTION 'startertarief is al beoordeeld of niet aangevraagd'; END IF;
  IF l.geactiveerd_op IS NOT NULL THEN RAISE EXCEPTION 'aanvraag is al geactiveerd'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting te lang'; END IF;
  nieuw := CASE WHEN _goedkeuren THEN 'goedgekeurd' ELSE 'afgewezen' END;
  PERFORM set_config('zp.starter_rpc', '1', true);
  UPDATE public.leads SET starter_controle_status = nieuw,
    tarief_type = CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END,
    starter_tot = CASE WHEN _goedkeuren THEN starter_tot ELSE NULL END,
    starter_beoordeeld_door = auth.uid(), starter_beoordeeld_op = now(), starter_toelichting = nullif(trim(_toelichting),'')
  WHERE id = _lead_id;
  UPDATE public.bav_aanmeldingen SET tarief_type = CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END,
    starter_tot = CASE WHEN _goedkeuren THEN starter_tot ELSE NULL END WHERE lead_id = _lead_id;
  PERFORM set_config('zp.starter_rpc', '0', true);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
  VALUES ('leads', _lead_id, 'startertarief_beoordeeld', 'starter_controle_status', 'te_controleren', nieuw, auth.uid(), public.get_user_role_label(auth.uid()));
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, is_test)
  VALUES ('startertarief_' || nieuw,
    'Startertarief ' || nieuw || ' (KVK-startdatum ' || coalesce(to_char(l.kvk_startdatum,'DD-MM-YYYY'),'onbekend') || ')' || coalesce(': ' || nullif(trim(_toelichting),''), ''),
    auth.uid(), (SELECT full_name FROM public.profiles WHERE id = auth.uid()), _lead_id, l.is_test);
  RETURN jsonb_build_object('status', nieuw, 'tarief_type', CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END);
END $function$;