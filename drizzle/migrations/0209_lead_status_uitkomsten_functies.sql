-- A23-aanvulling 3: uitkomsten gedragen zich als afgerond (afgesloten); afgerond blijft meetellen zoals nu.
CREATE OR REPLACE FUNCTION public.guard_lead_afgerond()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord') AND NEW.status IS DISTINCT FROM OLD.status
     AND OLD.type = 'verzekering_aanvraag'
     AND (OLD.geactiveerd_op IS NOT NULL OR OLD.status IN ('actief','gepauzeerd','opgezegd','klant')) THEN
    RAISE EXCEPTION 'Niet toegestaan: deze aanvraag heeft een polis; afsluiten zou de polisstatus overschrijven.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_lead_afgerond()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_naam text; v_toel text := nullif(btrim(current_setting('app.afrond_toelichting', true)), '');
  v_dicht boolean := NEW.status::text IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord');
  v_was boolean := OLD.status::text IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (v_dicht OR v_was) THEN
    SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email, is_test)
    VALUES (CASE WHEN v_dicht THEN 'lead_afgerond' ELSE 'lead_heropend' END,
      CASE NEW.status::text WHEN 'afgerond' THEN 'Afgerond' WHEN 'klant_geworden' THEN 'Afgesloten: Klant geworden'
        WHEN 'geen_interesse' THEN 'Afgesloten: Geen interesse' WHEN 'vraag_beantwoord' THEN 'Afgesloten: Vraag beantwoord'
        ELSE 'Heropend, status ' || NEW.status::text END || coalesce('. Toelichting: ' || v_toel, ''),
      auth.uid(), coalesce(v_naam, CASE WHEN auth.uid() IS NULL THEN 'systeem' ELSE 'teamlid' END), NEW.id, lower(NEW.email), NEW.is_test);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.lead_afsluiten(_lead_id uuid, _uitkomst text, _toelichting text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _uitkomst IS NULL OR _uitkomst NOT IN ('klant_geworden','geen_interesse','vraag_beantwoord') THEN RAISE EXCEPTION 'kies een uitkomst' USING ERRCODE = '22023'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting maximaal 500 tekens'; END IF;
  PERFORM set_config('app.afrond_toelichting', coalesce(_toelichting,''), true);
  UPDATE public.leads SET status = _uitkomst::public.lead_status WHERE id = _lead_id AND status::text <> _uitkomst;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead niet gevonden of heeft deze uitkomst al'; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lead_afsluiten(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_afsluiten(uuid, text, text) TO authenticated, service_role;

-- Vandaag te doen: afgesloten uitkomsten net als afgerond buiten de leadwerkvoorraad.
DO $do$
DECLARE d text; n text := '''afgerond'',''klant_geworden'',''geen_interesse'',''vraag_beantwoord''';
BEGIN
  SELECT pg_get_functiondef('public.mijn_acties_vandaag_basis(boolean)'::regprocedure) INTO d;
  IF position('klant_geworden' IN d) > 0 THEN RETURN; END IF;
  d := replace(d, '(''afgewezen'',''opgezegd'',''afgerond'')', '(''afgewezen'',''opgezegd'',' || n || ')');
  d := replace(d, '''nieuw_te_beoordelen'',''afgerond'')', '''nieuw_te_beoordelen'',' || n || ')');
  d := replace(d, 'l.status <> ''afgerond''', 'l.status NOT IN (' || n || ')');
  IF (length(d) - length(replace(d, 'klant_geworden', ''))) / length('klant_geworden') <> 4 THEN
    RAISE EXCEPTION 'mijn_acties_vandaag_basis: onverwachte structuur';
  END IF;
  EXECUTE d;
END $do$;