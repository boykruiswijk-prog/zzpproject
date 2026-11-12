-- Besluit Boy 12-11-2026 12:43: team mag einddatum oud en ingangsdatum nieuw aanpassen voor goedkeuring; zelfde validatie, reden verplicht, auditregel.
CREATE OR REPLACE FUNCTION public.rechtsvormwijziging_datums_aanpassen(_aanvraag uuid, _einddatum date, _ingangsdatum date, _reden text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a public.klant_service_aanvragen; v_start date; v_morgen date := ((now() AT TIME ZONE 'Europe/Amsterdam')::date + 1); v_reden text := btrim(coalesce(_reden,''));
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT (public.is_team_member(auth.uid()) AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag FOR UPDATE;
  IF a.id IS NULL OR a.type <> 'rechtsvormwijziging' THEN RAISE EXCEPTION 'verzoek niet gevonden'; END IF;
  IF a.status NOT IN ('nieuw','in_behandeling') OR a.details ? 'goedgekeurd' THEN RAISE EXCEPTION 'datums kunnen alleen voor goedkeuring worden aangepast'; END IF;
  IF _einddatum IS NULL OR _ingangsdatum IS NULL THEN RAISE EXCEPTION 'einddatum en ingangsdatum zijn verplicht'; END IF;
  IF length(v_reden) < 3 OR length(v_reden) > 500 THEN RAISE EXCEPTION 'reden is verplicht (3 tot 500 tekens)'; END IF;
  IF _ingangsdatum < v_morgen THEN RAISE EXCEPTION 'de ingangsdatum kan op zijn vroegst morgen zijn'; END IF;
  SELECT p.start_date INTO v_start FROM public.policies p WHERE p.id = nullif(a.details->>'polis_id','')::uuid;
  IF v_start IS NOT NULL AND _einddatum < v_start THEN RAISE EXCEPTION 'einddatum ligt voor de oorspronkelijke ingangsdatum'; END IF;
  IF _einddatum::text = a.details->>'einddatum' AND _ingangsdatum::text = a.details->>'ingangsdatum' THEN RAISE EXCEPTION 'de datums zijn niet gewijzigd'; END IF;
  UPDATE public.klant_service_aanvragen SET
    details = details || jsonb_build_object('einddatum', _einddatum::text, 'ingangsdatum', _ingangsdatum::text,
      'datums_aangepast', coalesce(details->'datums_aangepast','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'op', now(), 'door', auth.uid(), 'reden', v_reden,
        'oud', jsonb_build_object('einddatum', details->>'einddatum', 'ingangsdatum', details->>'ingangsdatum'),
        'nieuw', jsonb_build_object('einddatum', _einddatum::text, 'ingangsdatum', _ingangsdatum::text))))
  WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'rechtsvormwijziging_datums_aangepast', 'einddatum/ingangsdatum',
    coalesce(a.details->>'einddatum','-') || ' / ' || coalesce(a.details->>'ingangsdatum','-'), _einddatum::text || ' / ' || _ingangsdatum::text,
    auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('reden', v_reden));
  RETURN jsonb_build_object('ok', true, 'einddatum', _einddatum, 'ingangsdatum', _ingangsdatum);
END $function$;
REVOKE ALL ON FUNCTION public.rechtsvormwijziging_datums_aanpassen(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechtsvormwijziging_datums_aanpassen(uuid, date, date, text) TO authenticated, service_role;