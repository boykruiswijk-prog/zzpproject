CREATE OR REPLACE FUNCTION public.portaltoegang_auto_vastleggen(_aanvraag_id uuid, _onderneming_id uuid, _persoon_id uuid, _portal_user_id uuid, _user_created boolean, _message_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.klant_service_aanvragen; o public.ondernemingen; _polissen int; _op timestamptz := now();
  _systeem constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF public.portal_user_id_by_email(lower(btrim(a.email))) IS DISTINCT FROM _portal_user_id THEN RAISE EXCEPTION 'gebruiker hoort niet bij dit adres'; END IF;
  WITH u AS (UPDATE public.policies p SET user_id = _portal_user_id
     WHERE (p.user_id IS NULL OR p.user_id = _portal_user_id) AND p.onderneming_id = o.id RETURNING 1)
  SELECT count(*) INTO _polissen FROM u;
  UPDATE public.klant_service_aanvragen SET status = 'afgerond', behandeld_op = _op, onderneming_id = o.id,
    details = coalesce(details,'{}'::jsonb) || jsonb_build_object(
      'automatisch', jsonb_build_object('besluit', 'uitgenodigd', 'op', _op, 'reden', null),
      'toegang_verleend', jsonb_build_object('door', null, 'door_naam', 'automatisch', 'op', _op, 'email', lower(btrim(a.email)),
        'user_created', _user_created, 'persoon_id', _persoon_id, 'contactpersoon', 'bestaand', 'polissen_gekoppeld', _polissen, 'message_id', _message_id),
      'afgerond', jsonb_build_object('door', null, 'op', _op, 'toelichting', 'automatisch uitgenodigd'))
   WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'portaltoegang_auto_verleend', 'toegang', a.status, lower(btrim(a.email)), NULL, 'automatisch',
    jsonb_build_object('onderneming_id', o.id, 'persoon_id', _persoon_id, 'polissen_gekoppeld', _polissen, 'user_created', _user_created, 'message_id', _message_id));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, _persoon_id, 'overig', o.is_test, 'Automatisch uitgenodigd voor Mijn ZP op ' || lower(btrim(a.email)) || ' na een toegangsaanvraag.',
    _systeem, 'automatisch', jsonb_build_object('soort','portal_uitnodiging','email',lower(btrim(a.email)),'aanvraag_id',a.id,'automatisch',true));
  RETURN jsonb_build_object('ok', true, 'polissen_gekoppeld', _polissen);
END $$;
REVOKE ALL ON FUNCTION public.portaltoegang_auto_vastleggen(uuid, uuid, uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portaltoegang_auto_vastleggen(uuid, uuid, uuid, uuid, boolean, text) TO service_role;