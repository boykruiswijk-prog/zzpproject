CREATE OR REPLACE FUNCTION public.portaltoegang_koppelen(_aanvraag_id uuid, _onderneming_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE oud public.klant_service_aanvragen;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO oud FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF oud.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  IF oud.status = 'afgerond' THEN RAISE EXCEPTION 'aanvraag is al afgerond'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ondernemingen WHERE id = _onderneming_id) THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  UPDATE public.klant_service_aanvragen
     SET onderneming_id = _onderneming_id,
         status = CASE WHEN coalesce(status,'nieuw') = 'nieuw' THEN 'in_behandeling' ELSE status END,
         details = coalesce(details,'{}'::jsonb) || jsonb_build_object('koppeling', jsonb_build_object('door', auth.uid(), 'op', now(), 'vorige', oud.onderneming_id))
   WHERE id = _aanvraag_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', _aanvraag_id, 'portaltoegang_koppelen', 'onderneming_id', oud.onderneming_id::text, _onderneming_id::text,
          auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('email', oud.email));
  RETURN jsonb_build_object('ok', true);
END $function$;

CREATE OR REPLACE FUNCTION public.portaltoegang_afronden(_aanvraag_id uuid, _toelichting text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE oud public.klant_service_aanvragen;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO oud FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF oud.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting te lang'; END IF;
  UPDATE public.klant_service_aanvragen
     SET status = 'afgerond', behandeld_door = auth.uid(), behandeld_op = now(),
         details = coalesce(details,'{}'::jsonb) || jsonb_build_object('afgerond', jsonb_build_object('door', auth.uid(), 'op', now(), 'toelichting', nullif(btrim(coalesce(_toelichting,'')),'')))
   WHERE id = _aanvraag_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', _aanvraag_id, 'portaltoegang_afronden', 'status', oud.status, 'afgerond',
          auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('email', oud.email, 'toelichting', _toelichting));
  RETURN jsonb_build_object('ok', true);
END $function$;

REVOKE ALL ON FUNCTION public.portaltoegang_koppelen(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portaltoegang_afronden(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portaltoegang_koppelen(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portaltoegang_afronden(uuid, text) TO authenticated, service_role;