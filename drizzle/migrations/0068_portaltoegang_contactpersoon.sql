CREATE OR REPLACE FUNCTION public.portaltoegang_verlenen(_aanvraag_id uuid, _portal_user_id uuid, _user_created boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.klant_service_aanvragen; o public.ondernemingen; _email text; _pid uuid; _nieuw_persoon boolean := false;
  _nieuw_koppeling boolean := false; _polissen int := 0; _naam text; _op timestamptz := now();
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'portaltoegang' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'portaltoegang-aanvraag niet gevonden'; END IF;
  IF a.onderneming_id IS NULL THEN RAISE EXCEPTION 'koppel de aanvraag eerst aan een klant'; END IF;
  IF a.status = 'afgerond' THEN RAISE EXCEPTION 'aanvraag is al afgerond'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = a.onderneming_id;
  _email := lower(btrim(coalesce(a.email,'')));
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'ongeldig e-mailadres'; END IF;
  IF _portal_user_id IS NULL OR public.portal_user_id_by_email(_email) IS DISTINCT FROM _portal_user_id THEN RAISE EXCEPTION 'gebruiker hoort niet bij dit adres'; END IF;

  -- Bestaande contactpersoon bij deze klant?
  SELECT p.id INTO _pid FROM public.persoon_onderneming po JOIN public.personen p ON p.id = po.persoon_id
   WHERE po.onderneming_id = o.id AND (lower(btrim(p.genormaliseerd_email)) = _email OR lower(btrim(p.email_weergave)) = _email) LIMIT 1;
  IF _pid IS NULL THEN
    -- Bestaande persoon elders hergebruiken (niets overschrijven), anders nieuw.
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

  -- Polissen van deze klant aan de portalgebruiker (alleen vrije of al eigen polissen).
  WITH u AS (
    UPDATE public.policies p SET user_id = _portal_user_id
     WHERE (p.user_id IS NULL OR p.user_id = _portal_user_id)
       AND (p.onderneming_id = o.id OR p.lead_id IN (SELECT kc.lead_id FROM public.klant_contracten kc WHERE kc.onderneming_id = o.id AND kc.lead_id IS NOT NULL))
     RETURNING 1)
  SELECT count(*) INTO _polissen FROM u;

  SELECT full_name INTO _naam FROM public.profiles WHERE id = auth.uid();
  UPDATE public.klant_service_aanvragen SET
    status = CASE WHEN status = 'nieuw' THEN 'in_behandeling' ELSE status END,
    details = coalesce(details,'{}'::jsonb) || jsonb_build_object('toegang_verleend', jsonb_build_object(
      'door', auth.uid(), 'door_naam', coalesce(_naam,'teamlid'), 'op', _op, 'email', _email, 'user_created', _user_created,
      'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END, 'polissen_gekoppeld', _polissen))
   WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'portaltoegang_verleend', 'toegang', NULL, _email, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', o.id, 'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END,
      'persoon_nieuw', _nieuw_persoon, 'polissen_gekoppeld', _polissen, 'user_created', _user_created));
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (o.id, _pid, 'overig', o.is_test,
    'Mijn ZP-toegang verleend aan ' || _email || ' door ' || coalesce(_naam,'teamlid') || '. Contactpersoon ' || CASE WHEN _nieuw_koppeling THEN 'toegevoegd' ELSE 'bestond al' END || '.',
    auth.uid(), coalesce(_naam,'teamlid'), jsonb_build_object('soort','portal_uitnodiging','email',_email,'aanvraag_id',a.id,'contactpersoon',CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END));
  RETURN jsonb_build_object('ok', true, 'persoon_id', _pid, 'contactpersoon', CASE WHEN _nieuw_koppeling THEN 'nieuw' ELSE 'bestaand' END, 'polissen_gekoppeld', _polissen, 'klant', o.naam);
END $$;
REVOKE ALL ON FUNCTION public.portaltoegang_verlenen(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portaltoegang_verlenen(uuid, uuid, boolean) TO authenticated;