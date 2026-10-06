CREATE OR REPLACE FUNCTION public.crm_notitie_toevoegen(_onderneming_id uuid, _persoon_id uuid, _soort text, _tekst text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_naam text; v_test boolean := false;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _onderneming_id IS NULL AND _persoon_id IS NULL THEN RAISE EXCEPTION 'kies een onderneming of persoon'; END IF;
  IF _soort NOT IN ('notitie','telefoon','opzegging','stop','ondernemingswijziging','overig') THEN RAISE EXCEPTION 'ongeldige soort'; END IF;
  IF length(btrim(coalesce(_tekst,''))) = 0 THEN RAISE EXCEPTION 'tekst is verplicht'; END IF;
  SELECT coalesce(nullif(full_name,''), 'teamlid') INTO v_naam FROM public.profiles WHERE id = auth.uid();
  SELECT coalesce((SELECT is_test FROM public.ondernemingen WHERE id = _onderneming_id), false)
      OR coalesce((SELECT is_test FROM public.personen WHERE id = _persoon_id), false) INTO v_test;
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
  VALUES (_onderneming_id, _persoon_id, _soort, btrim(_tekst), auth.uid(), v_naam, v_test, coalesce(_details,'{}'::jsonb))
  RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('crm_notities', v_id, 'notitie_toegevoegd', 'soort', _soort, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', _onderneming_id, 'persoon_id', _persoon_id));
  RETURN v_id;
END $$;