DO $do$
DECLARE d text := pg_get_functiondef('public.lead_ingangsdatum_wijzigen(uuid,date,text)'::regprocedure); n text;
BEGIN
  n := replace(d, $a$IF oud IS NOT DISTINCT FROM _datum THEN RAISE EXCEPTION 'datum is ongewijzigd'; END IF;$a$,
$a$IF oud IS NOT DISTINCT FROM _datum THEN
    -- Ongewijzigde datum = interne bevestiging (bijv. te vroege klantdatum bewust laten staan). Geen datumupdate.
    naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
    INSERT INTO public.sensitive_audit_log (target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol)
    VALUES ('leads',_lead_id,'ingangsdatum_bevestigd','ingangsdatum',oud::text,_datum::text,auth.uid(),public.get_user_role_label(auth.uid()));
    INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
    VALUES ('ingangsdatum_gewijzigd', 'Ingangsdatum ' || to_char(_datum,'DD-MM-YYYY') || ' intern bevestigd (ongewijzigd): ' || trim(_toelichting),
      auth.uid(), naam, _lead_id, lower(l.email), l.is_test);
    UPDATE public.leads SET activatie_log = coalesce(activatie_log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'tijd', now(), 'actie','ingangsdatum_bevestigd', 'oud', oud, 'nieuw', _datum, 'door', auth.uid(), 'door_naam', naam, 'toelichting', trim(_toelichting)))
    WHERE id=_lead_id AND (activatie_log IS NULL OR jsonb_typeof(activatie_log)='array');
    RETURN jsonb_build_object('oud',oud,'nieuw',_datum,'bevestigd',true);
  END IF;$a$);
  IF n = d THEN RAISE EXCEPTION 'lead_ingangsdatum_wijzigen onverwacht'; END IF;
  EXECUTE n;
END $do$;