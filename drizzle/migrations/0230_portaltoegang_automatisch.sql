-- Toegang verlenen rondt de aanvraag direct af (met tijd en wie), zodat niets op 'nieuw'/'in behandeling' blijft hangen.
CREATE OR REPLACE FUNCTION public.portaltoegang_verlenen(_aanvraag_id uuid, _portal_user_id uuid, _user_created boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a public.klant_service_aanvragen; o public.ondernemingen; _email text; _pid uuid; _nieuw_persoon boolean := false;
  _nieuw_koppeling boolean := false; _polissen int := 0; _naam text; _op timestamptz := now();
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  IF a.onderneming_id IS NULL THEN RAISE EXCEPTION 'koppel de aanvraag eerst aan een klant'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = a.onderneming_id;
  _email := lower(btrim(coalesce(a.email,'')));
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'ongeldig e-mailadres'; END IF;
  IF _portal_user_id IS NULL OR public.portal_user_id_by_email(_email) IS DISTINCT FROM _portal_user_id THEN RAISE EXCEPTION 'gebruiker hoort niet bij dit adres'; END IF;
  SELECT p.id INTO _pid FROM public.persoon_onderneming po JOIN public.personen p ON p.id = po.persoon_id
   WHERE po.onderneming_id = o.id AND (lower(btrim(p.genormaliseerd_email)) = _email OR lower(btrim(p.email_weergave)) = _email) LIMIT 1;
  IF _pid IS NULL THEN
    SELECT id INTO _pid FROM public.personen WHERE lower(btrim(genormaliseerd_email)) = _email AND is_test = o.is_test ORDER BY created_at LIMIT 1;
    IF _pid IS NULL THEN
      INSERT INTO public.personen (genormaliseerd_email, email_weergave, voornaam, achternaam, telefoon, is_test)
      VALUES (_email, _email, nullif(btrim(coalesce(a.voornaam,'')),''), nullif(btrim(coalesce(a.achternaam,'')),''), nullif(btrim(coalesce(a.telefoon,'')),''), o.is_test)
      RETURNING id INTO _pid;
      _nieuw_persoon := true;
    END IF;
    INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id) VALUES (_pid, o.id) ON CONFLICT DO NOTHING;
    _nieuw_koppeling := true;
  END IF;
  WITH u AS (
    UPDATE public.policies p SET user_id = _portal_user_id
     WHERE (p.user_id IS NULL OR p.user_id = _portal_user_id) AND (p.onderneming_id = o.id)
     RETURNING 1)
  SELECT count(*) INTO _polissen FROM u;
  SELECT full_name INTO _naam FROM public.profiles WHERE id = auth.uid();
  UPDATE public.klant_service_aanvragen SET
    status = 'afgerond', behandeld_door = auth.uid(), behandeld_op = _op,
    details = coalesce(details,'{}'::jsonb) || jsonb_build_object('toegang_verleend', jsonb_build_object(
      'door', auth.uid(), 'door_naam', coalesce(_naam,'teamlid'), 'op', _op, 'email', _email, 'user_created', _user_created,
      'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END, 'polissen_gekoppeld', _polissen),
      'afgerond', jsonb_build_object('door', auth.uid(), 'op', _op, 'toelichting', 'Uitnodiging verstuurd door ' || coalesce(_naam,'teamlid')))
   WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'portaltoegang_verleend', 'toegang', a.status, _email, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', o.id, 'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END,
      'persoon_nieuw', _nieuw_persoon, 'polissen_gekoppeld', _polissen, 'user_created', _user_created));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, _pid, 'overig', o.is_test,
    'Mijn ZP-toegang verleend aan ' || _email || ' door ' || coalesce(_naam,'teamlid') || '. Contactpersoon ' || CASE WHEN _nieuw_koppeling THEN 'toegevoegd' ELSE 'bestond al' END || '.',
    auth.uid(), coalesce(_naam,'teamlid'), jsonb_build_object('soort','portal_uitnodiging','email',_email,'aanvraag_id',a.id,'contactpersoon',CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END));
  RETURN jsonb_build_object('ok', true, 'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END, 'polissen_gekoppeld', _polissen, 'klant', o.naam);
END $function$;

-- Automatische match: adres hoort exact bij een persoon die aan precies één actieve klant hangt.
CREATE OR REPLACE FUNCTION public.portaltoegang_auto_match(_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e text := lower(btrim(coalesce(_email,''))); n_pers int; n_ond int; r record; testadres boolean;
BEGIN
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('match', false, 'reden', 'geen geldig e-mailadres'); END IF;
  testadres := e LIKE '%@zpzaken.nl';
  SELECT count(*) INTO n_pers FROM public.personen p
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e) AND (p.is_test = false OR testadres);
  IF n_pers = 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres staat bij geen contactpersoon van een klant'); END IF;
  SELECT count(DISTINCT o.id) INTO n_ond FROM public.personen p
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e)
     AND (p.is_test = false OR testadres) AND o.samengevoegd_naar IS NULL AND (o.is_test = false OR (testadres AND p.is_test))
     AND o.is_test = p.is_test
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND k.is_test = o.is_test);
  IF n_ond = 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'contactpersoon gevonden, maar geen klant met een actief contract'); END IF;
  IF n_ond > 1 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres hoort bij meerdere klanten (' || n_ond || '), kies zelf'); END IF;
  SELECT o.id AS ond, p.id AS pid, o.naam, p.voornaam INTO r FROM public.personen p
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e)
     AND (p.is_test = false OR testadres) AND o.samengevoegd_naar IS NULL AND o.is_test = p.is_test
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND k.is_test = o.is_test)
   ORDER BY p.created_at LIMIT 1;
  RETURN jsonb_build_object('match', true, 'onderneming_id', r.ond, 'persoon_id', r.pid, 'klant', r.naam, 'voornaam', r.voornaam);
END $$;
REVOKE ALL ON FUNCTION public.portaltoegang_auto_match(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portaltoegang_auto_match(text) TO service_role;

-- Automatisch vastleggen na verstuurde uitnodiging (alleen service_role).
CREATE OR REPLACE FUNCTION public.portaltoegang_auto_vastleggen(_aanvraag_id uuid, _onderneming_id uuid, _persoon_id uuid, _portal_user_id uuid, _user_created boolean, _message_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.klant_service_aanvragen; o public.ondernemingen; _polissen int; _op timestamptz := now();
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
    NULL, 'automatisch', jsonb_build_object('soort','portal_uitnodiging','email',lower(btrim(a.email)),'aanvraag_id',a.id,'automatisch',true));
  RETURN jsonb_build_object('ok', true, 'polissen_gekoppeld', _polissen);
END $$;
REVOKE ALL ON FUNCTION public.portaltoegang_auto_vastleggen(uuid, uuid, uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portaltoegang_auto_vastleggen(uuid, uuid, uuid, uuid, boolean, text) TO service_role;