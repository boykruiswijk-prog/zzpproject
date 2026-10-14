CREATE OR REPLACE FUNCTION public.zet_herkomst_klant(p_lead_id uuid, p_keuze text, p_toelichting text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l public.leads; v_naam text; v_toel text; v_rec jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_team_member(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  IF p_keuze IS NULL OR p_keuze NOT IN ('Google','Bing','AI-assistent','Doorverwijzing','Social media','Eerder klant','Anders') THEN
    RAISE EXCEPTION 'ongeldige keuze';
  END IF;
  v_toel := nullif(btrim(coalesce(p_toelichting, '')), '');
  IF v_toel IS NOT NULL AND char_length(v_toel) > 300 THEN
    RAISE EXCEPTION 'toelichting maximaal 300 tekens';
  END IF;
  SELECT * INTO l FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead niet gevonden'; END IF;
  v_rec := jsonb_build_object('keuze', p_keuze, 'toelichting', v_toel, 'ingevuld_door', auth.uid(), 'ingevuld_op', now());
  UPDATE public.leads
     SET extra_data = coalesce(extra_data, '{}'::jsonb) || jsonb_build_object('herkomst_klant', v_rec)
   WHERE id = p_lead_id;
  SELECT coalesce(full_name, 'teamlid') INTO v_naam FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email, is_test)
  VALUES ('herkomst_klant_ingevuld', 'Herkomst volgens klant: ' || p_keuze || coalesce(' (' || v_toel || ')', ''),
    auth.uid(), coalesce(v_naam, 'teamlid'), l.id, l.email, coalesce(l.is_test, false));
  RETURN v_rec;
END $function$;
REVOKE ALL ON FUNCTION public.zet_herkomst_klant(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.zet_herkomst_klant(uuid, text, text) TO authenticated;