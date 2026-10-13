CREATE OR REPLACE FUNCTION public.verwerk_opzegging_circle8(_aanvraag_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.klant_service_aanvragen;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'opzeggen' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'opzegging niet gevonden'; END IF;
  IF a.opzegging_verwerkt_op IS NOT NULL THEN RAISE EXCEPTION 'opzegging is al verwerkt'; END IF;
  IF a.koppeling_status = 'zeker' AND a.onderneming_id IS NOT NULL THEN
    RAISE EXCEPTION 'deze opzegging is al aan een klant gekoppeld; verwerk hem via de klant';
  END IF;
  UPDATE public.klant_service_aanvragen SET
    koppeling_status = 'collectief',
    koppeling_methode = 'circle8_collectief',
    koppeling_details = coalesce(koppeling_details, '{}'::jsonb) || jsonb_build_object('circle8_door', auth.uid(), 'circle8_op', now()),
    opzegging_verwerkt_op = now(),
    opzegging_verwerkt_door = auth.uid(),
    status = CASE WHEN status IS NULL OR status IN ('nieuw','in_behandeling') THEN 'afgerond' ELSE status END
  WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'opzegging_circle8', 'koppeling_status', a.koppeling_status, 'collectief',
          auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('vorige_methode', a.koppeling_methode, 'vorige_onderneming_id', a.onderneming_id));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.verwerk_opzegging_circle8(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verwerk_opzegging_circle8(uuid) TO authenticated;