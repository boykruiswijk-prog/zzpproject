CREATE TABLE public.bav_nummer_nakijken (
  onderneming_id uuid PRIMARY KEY REFERENCES public.ondernemingen(id),
  status text NOT NULL DEFAULT 'later' CHECK (status IN ('later')),
  toelichting text,
  gemarkeerd_door uuid NOT NULL,
  gemarkeerd_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bav_nummer_nakijken TO authenticated;
GRANT ALL ON public.bav_nummer_nakijken TO service_role;
ALTER TABLE public.bav_nummer_nakijken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest BAV-nakijken" ON public.bav_nummer_nakijken FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.bav_sleutel(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(upper(regexp_replace(coalesce(_t,''),'[^A-Za-z0-9]','','g')),'')
$$;

-- Bij welke andere klant staat dit nummer al? Uitzondering: vastgelegde omzetting tussen beide ondernemingen.
CREATE OR REPLACE FUNCTION public.bav_nummer_bezet_door(_nummer text, _voor_ond uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('onderneming_id', b.onderneming_id, 'naam', o.naam, 'exact_relatie_code', o.exact_relatie_code, 'bron', b.bron, 'nummer', b.nummer)
    FROM public.crm_bav_nummers b LEFT JOIN public.ondernemingen o ON o.id = b.onderneming_id
   WHERE public.bav_sleutel(b.nummer) = public.bav_sleutel(_nummer) AND b.bron <> 'hiscox'
     AND b.onderneming_id IS DISTINCT FROM _voor_ond
     AND NOT (_voor_ond IS NOT NULL AND b.onderneming_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.onderneming_opvolging x
          WHERE (x.van_onderneming_id = b.onderneming_id AND x.naar_onderneming_id = _voor_ond) OR (x.naar_onderneming_id = b.onderneming_id AND x.van_onderneming_id = _voor_ond)))
   ORDER BY (b.bron IN ('zp','bevestigd','overgenomen')) DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.bav_nummer_bezet_door(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_bezet_door(text, uuid) TO authenticated, service_role;

-- Nieuw ZPBAV-nummer: overslaan zodra het nummer (of hetzelfde getal als AFAS-abonnementsnummer of klantopgave) ergens bekend is.
CREATE OR REPLACE FUNCTION public.eerste_vrije_certificaatnummer(_start bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint := _start;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.policies WHERE upper(certificate_number) = 'ZPBAV' || n)
     OR EXISTS (SELECT 1 FROM public.klant_certificaten WHERE upper(certificaatnummer) = 'ZPBAV' || n)
     OR EXISTS (SELECT 1 FROM public.crm_bav_nummers b WHERE b.bron <> 'hiscox' AND (
          public.bav_sleutel(b.nummer) = 'ZPBAV' || n
          OR ltrim(regexp_replace(regexp_replace(upper(b.nummer),'^\s*ZPBAV',''),'\D','','g'),'0') = n::text)) LOOP
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.bav_nummer_bevestigen(_onderneming_id uuid, _nummer text, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nr text := upper(btrim(coalesce(_nummer,''))); v_id uuid; v_bezet jsonb;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_bav_nummers b WHERE b.onderneming_id = _onderneming_id AND b.bron = 'klant' AND upper(b.nummer) = v_nr) THEN
    RAISE EXCEPTION 'alleen een door de klant opgegeven BAV-nummer van deze klant kan worden bevestigd'; END IF;
  v_bezet := public.bav_nummer_bezet_door(v_nr, _onderneming_id);
  IF v_bezet IS NOT NULL THEN RAISE EXCEPTION 'BAV-nummer % bestaat al bij %', v_nr, coalesce(v_bezet->>'naam','een andere klant'); END IF;
  INSERT INTO public.bav_nummer_bevestigingen (onderneming_id, nummer, herkomst, toelichting, bevestigd_door)
  VALUES (_onderneming_id, v_nr, 'klant', nullif(btrim(coalesce(_toelichting,'')),''), auth.uid())
  ON CONFLICT (onderneming_id, nummer) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('bav_nummer_bevestigingen', v_id, 'bav_nummer_bevestigd', 'nummer', NULL, v_nr, auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('onderneming_id', _onderneming_id, 'herkomst', 'klant'));
    PERFORM public.crm_notitie_toevoegen(_onderneming_id, NULL, 'notitie', 'BAV-nummer ' || v_nr || ' bevestigd (opgegeven door klant).', jsonb_build_object('bav_nummer', v_nr));
  END IF;
  RETURN jsonb_build_object('nummer', v_nr, 'nieuw', v_id IS NOT NULL);
END $$;

-- Handmatig ingevoerd BAV-nummer bevestigen (werklijst), met toelichting, unieke controle en logging.
CREATE OR REPLACE FUNCTION public.bav_nummer_handmatig_bevestigen(_onderneming_id uuid, _nummer text, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nr text := upper(regexp_replace(btrim(coalesce(_nummer,'')),'\s+','','g')); v_id uuid; v_bezet jsonb;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ondernemingen WHERE id = _onderneming_id) THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  IF length(v_nr) < 3 OR v_nr !~ '^[A-Z0-9.\-/]+$' THEN RAISE EXCEPTION 'ongeldig BAV-nummer'; END IF;
  IF length(btrim(coalesce(_toelichting,''))) < 3 THEN RAISE EXCEPTION 'toelichting is verplicht (waar komt het nummer vandaan?)'; END IF;
  v_bezet := public.bav_nummer_bezet_door(v_nr, _onderneming_id);
  IF v_bezet IS NOT NULL THEN
    RAISE EXCEPTION 'BAV-nummer % bestaat al bij % (Exact-relatiecode %, %)', v_nr, coalesce(v_bezet->>'naam','een andere klant'), coalesce(v_bezet->>'exact_relatie_code','onbekend'), v_bezet->>'bron';
  END IF;
  INSERT INTO public.bav_nummer_bevestigingen (onderneming_id, nummer, herkomst, toelichting, bevestigd_door)
  VALUES (_onderneming_id, v_nr, 'handmatig', btrim(_toelichting), auth.uid())
  ON CONFLICT (onderneming_id, nummer) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('bav_nummer_bevestigingen', v_id, 'bav_nummer_bevestigd', 'nummer', NULL, v_nr, auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('onderneming_id', _onderneming_id, 'herkomst', 'handmatig', 'toelichting', btrim(_toelichting)));
    PERFORM public.crm_notitie_toevoegen(_onderneming_id, NULL, 'notitie', 'BAV-nummer ' || v_nr || ' handmatig bevestigd: ' || btrim(_toelichting), jsonb_build_object('bav_nummer', v_nr));
  END IF;
  RETURN jsonb_build_object('nummer', v_nr, 'nieuw', v_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.bav_nummer_handmatig_bevestigen(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_handmatig_bevestigen(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bav_nummer_later(_onderneming_id uuid, _toelichting text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  INSERT INTO public.bav_nummer_nakijken (onderneming_id, toelichting, gemarkeerd_door) VALUES (_onderneming_id, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid())
  ON CONFLICT (onderneming_id) DO UPDATE SET toelichting = EXCLUDED.toelichting, gemarkeerd_door = EXCLUDED.gemarkeerd_door, gemarkeerd_op = now();
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('bav_nummer_nakijken', _onderneming_id, 'bav_nummer_later', 'status', NULL, 'later', auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('toelichting', _toelichting));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.bav_nummer_later(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_later(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bav_nummer_werklijst()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN coalesce((SELECT jsonb_agg(r ORDER BY (r->>'later') IS NOT NULL, r->>'naam') FROM (
    SELECT jsonb_build_object(
      'onderneming_id', o.id, 'naam', o.naam, 'kvk', o.kvk, 'exact_relatie_code', o.exact_relatie_code,
      'afas', (SELECT jsonb_agg(DISTINCT b.nummer) FROM public.crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron = 'afas_abonnement'),
      'klantopgave', (SELECT jsonb_agg(DISTINCT b.nummer) FROM public.crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron = 'klant'),
      'contracten', (SELECT jsonb_agg(jsonb_build_object('abonnement_nr', k.abonnement_nr, 'product', k.product, 'status', k.status, 'begin', k.begin_datum, 'eind', k.eind_datum, 'bedrag', k.bedrag_per_periode, 'cyclus', k.cyclus) ORDER BY k.begin_datum) FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND NOT k.is_test),
      'later', (SELECT jsonb_build_object('op', n.gemarkeerd_op, 'toelichting', n.toelichting) FROM public.bav_nummer_nakijken n WHERE n.onderneming_id = o.id)
    ) AS r
    FROM public.ondernemingen o
    WHERE NOT o.is_test
      AND EXISTS (SELECT 1 FROM public.crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron = 'afas_abonnement')
      AND NOT EXISTS (SELECT 1 FROM public.crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','bevestigd','overgenomen'))
  ) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.bav_nummer_werklijst() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_werklijst() TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_tellers()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); fact boolean;
BEGIN
  IF NOT public.is_team_member(me) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  fact := public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie);
  RETURN jsonb_build_object(
    'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag' AND geactiveerd_op IS NULL AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland','offerte_verstuurd')),
    'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag' AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland')),
    'service', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type NOT IN ('opzeggen','portaltoegang') AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'opzeggingen', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type = 'opzeggen' AND opzegging_verwerkt_op IS NULL AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'screening', (SELECT count(*) FROM screening_aanvragen WHERE NOT is_test AND coalesce(status,'nieuw') NOT IN ('afgerond','afgewezen','geannuleerd')),
    'afgehaakt', (SELECT count(*) FROM aanvraag_concepten WHERE NOT is_test AND status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL AND laatst_actief_op >= now() - interval '7 days' AND laatst_actief_op < now() - interval '30 minutes'),
    'chat', (SELECT count(*) FROM chat_sessions s JOIN leads l ON l.id = s.lead_id WHERE NOT s.is_test AND NOT l.is_test AND l.status IN ('nieuw','nieuw_te_beoordelen')),
    'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')) + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'nieuwe_aanvraag_nodig'),
    'bav_nakijken', (SELECT count(*) FROM ondernemingen o WHERE NOT o.is_test
      AND EXISTS (SELECT 1 FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron = 'afas_abonnement')
      AND NOT EXISTS (SELECT 1 FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','bevestigd','overgenomen'))
      AND NOT EXISTS (SELECT 1 FROM bav_nummer_nakijken n WHERE n.onderneming_id = o.id)),
    'facturatie', CASE WHEN fact THEN
      (SELECT count(*) FROM leads WHERE NOT is_test AND exact_invoice_id IS NOT NULL AND exact_invoice_number IS NULL AND coalesce(exact_invoice_status,0) <> 50)
      + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'exact_aanpassen') ELSE 0 END
  );
END $$;