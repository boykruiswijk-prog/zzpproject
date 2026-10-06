-- BAV-nummers per onderneming/lead/contract. Bronnen: zp (site-certificaat), afas (AFAS-abonnementsnummer), klant (opgave klant), hiscox (HPI.-polisnummer klant).
CREATE OR REPLACE VIEW public.crm_bav_nummers WITH (security_invoker = on) AS
SELECT 'zp'::text AS bron, btrim(p.certificate_number) AS nummer, p.onderneming_id, p.lead_id, p.id AS policy_id, NULL::uuid AS contract_id, p.status, p.created_at AS datum
  FROM public.policies p WHERE coalesce(btrim(p.certificate_number),'') <> ''
UNION ALL
SELECT 'zp', btrim(kc.certificaatnummer), kc.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, kc.koppeling_status, kc.aanvraagdatum::timestamptz
  FROM public.klant_certificaten kc WHERE kc.onderneming_id IS NOT NULL AND kc.koppeling_status = 'bevestigd' AND coalesce(btrim(kc.certificaatnummer),'') <> ''
UNION ALL
SELECT 'afas', btrim(k.abonnement_nr), k.onderneming_id, NULL::uuid, NULL::uuid, k.id, k.status, k.begin_datum::timestamptz
  FROM public.klant_contracten k WHERE coalesce(btrim(k.abonnement_nr),'') <> ''
UNION ALL
SELECT CASE WHEN a.polisnummer ~* '^\s*HPI\.' THEN 'hiscox' ELSE 'klant' END, upper(btrim(a.polisnummer)), a.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, a.status, a.created_at
  FROM public.klant_service_aanvragen a WHERE coalesce(btrim(a.polisnummer),'') <> '';
COMMENT ON VIEW public.crm_bav_nummers IS 'BAV-nummer per klant. afas = klant_contracten.abonnement_nr (AFAS-abonnementsnummer; de AFAS-import bevat geen apart certificaatnummer).';
REVOKE ALL ON public.crm_bav_nummers FROM anon, public;
GRANT SELECT ON public.crm_bav_nummers TO authenticated;
GRANT SELECT ON public.crm_bav_nummers TO service_role;

-- Beeindigen: alleen lopende contracten zonder einddatum; open opzegverzoeken worden automatisch afgerond met verwijzing.
CREATE OR REPLACE FUNCTION public.crm_beeindig(_onderneming_id uuid, _contract_ids uuid[], _policy_ids uuid[], _einddatum date, _reden text, _toelichting text, _persoon_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.ondernemingen; p record; r record; v_aid uuid; n int := 0; np int := 0; credits jsonb := '[]'::jsonb;
  v_notitie uuid; v_tekst text; v_label text; v_regels text := ''; v_open text := ''; v_open_ids uuid[] := '{}';
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF _reden NOT IN ('opzegging_klant','eerdere_opzegging','ondernemingswijziging','wanbetaling','stoppen_onderneming','overig') THEN RAISE EXCEPTION 'ongeldige reden'; END IF;
  IF length(btrim(coalesce(_toelichting,''))) < 3 THEN RAISE EXCEPTION 'toelichting is verplicht'; END IF;
  IF _einddatum IS NULL OR _einddatum > (now() AT TIME ZONE 'Europe/Amsterdam')::date + 366 THEN RAISE EXCEPTION 'ongeldige einddatum'; END IF;
  IF coalesce(array_length(_contract_ids,1),0) + coalesce(array_length(_policy_ids,1),0) = 0 THEN RAISE EXCEPTION 'kies minstens een contract of polis'; END IF;
  v_label := CASE _reden WHEN 'opzegging_klant' THEN 'Opzegging klant' WHEN 'eerdere_opzegging' THEN 'Eerdere opzegging niet verwerkt'
    WHEN 'ondernemingswijziging' THEN 'Ondernemingswijziging' WHEN 'wanbetaling' THEN 'Wanbetaling'
    WHEN 'stoppen_onderneming' THEN 'Overlijden of stoppen onderneming' ELSE 'Overig' END;

  IF coalesce(array_length(_contract_ids,1),0) > 0 THEN
    SELECT pe.* INTO p FROM public.personen pe JOIN public.persoon_onderneming po ON po.persoon_id = pe.id
      WHERE po.onderneming_id = o.id ORDER BY (pe.id = _persoon_id) DESC, po.created_at LIMIT 1;
    INSERT INTO public.klant_service_aanvragen (type, voornaam, achternaam, email, telefoon, polisnummer, details, status, onderneming_id, is_test, geverifieerd)
    VALUES ('opzeggen', coalesce(p.voornaam,''), coalesce(p.achternaam,''), coalesce(p.email_weergave,''), '', '',
      jsonb_build_object('opzegdatum', _einddatum, 'bron', 'beheer_handmatig', 'reden', _reden, 'reden_label', v_label, 'toelichting', _toelichting, 'bedrijfsnaam', o.naam),
      'in_behandeling', o.id, o.is_test, true)
    RETURNING id INTO v_aid;
    UPDATE public.klant_service_aanvragen SET onderneming_id = o.id, koppeling_status = 'zeker', koppeling_methode = 'handmatig_beheer' WHERE id = v_aid;
    FOR r IN SELECT * FROM public.klant_contracten WHERE id = ANY(_contract_ids) FOR UPDATE LOOP
      IF r.onderneming_id <> o.id THEN RAISE EXCEPTION 'contractregel hoort niet bij deze klant'; END IF;
      IF r.status <> 'actief' OR r.eind_datum IS NOT NULL THEN
        RAISE EXCEPTION 'contractregel % is al beeindigd of loopt al af per %', r.bron_rij, to_char(r.eind_datum,'DD-MM-YYYY');
      END IF;
      UPDATE public.klant_contracten SET eind_datum = _einddatum, status = 'loopt_af',
        afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY'))
       WHERE id = r.id;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
      VALUES ('klant_contracten', r.id, 'handmatig_beeindigd', 'eind_datum/status',
        coalesce(r.eind_datum::text,'-') || ' / ' || r.status, _einddatum::text || ' / loopt_af',
        auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('aanvraag_id', v_aid, 'bron_rij', r.bron_rij, 'reden', _reden));
      credits := credits || jsonb_build_array(jsonb_build_object('bron_rij', r.bron_rij, 'product', r.product) || public.plan_opzeg_credit(r.id, v_aid, _einddatum));
      v_regels := v_regels || E'\n- contractregel ' || r.bron_rij || ' (' || r.product || ')';
      n := n + 1;
    END LOOP;
    IF n <> array_length(_contract_ids,1) THEN RAISE EXCEPTION 'niet alle contractregels gevonden'; END IF;
    UPDATE public.klant_service_aanvragen SET opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(), status = 'afgerond' WHERE id = v_aid;
  END IF;

  IF coalesce(array_length(_policy_ids,1),0) > 0 THEN
    FOR r IN SELECT * FROM public.policies WHERE id = ANY(_policy_ids) FOR UPDATE LOOP
      IF NOT (r.onderneming_id = o.id OR (r.onderneming_id IS NULL AND EXISTS (
          SELECT 1 FROM public.persoon_bron_koppeling k JOIN public.persoon_onderneming po ON po.persoon_id = k.persoon_id
           WHERE k.bron_tabel = 'leads' AND k.bron_id = r.lead_id AND po.onderneming_id = o.id))) THEN
        RAISE EXCEPTION 'polis hoort niet bij deze klant';
      END IF;
      IF r.status <> 'geldig' THEN RAISE EXCEPTION 'polis % is al beeindigd', r.certificate_number; END IF;
      UPDATE public.policies SET status = 'ingetrokken', ingetrokken_op = now(), ingetrokken_door = auth.uid(),
        intrek_reden = 'Beeindigd per ' || to_char(_einddatum,'DD-MM-YYYY') || ': ' || v_label || '. ' || btrim(_toelichting)
       WHERE id = r.id;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
      VALUES ('policies', r.id, 'handmatig_beeindigd', 'status', r.status, 'ingetrokken', auth.uid(), public.get_user_role_label(auth.uid()),
        jsonb_build_object('einddatum', _einddatum, 'reden', _reden, 'aanvraag_id', v_aid));
      v_regels := v_regels || E'\n- polis ' || coalesce(r.certificate_number,'zonder nummer');
      np := np + 1;
    END LOOP;
    IF np <> array_length(_policy_ids,1) THEN RAISE EXCEPTION 'niet alle polissen gevonden'; END IF;
  END IF;

  -- Open opzegverzoeken van dezelfde onderneming afronden met verwijzing (niets verwijderen).
  FOR r IN UPDATE public.klant_service_aanvragen
      SET status = 'afgerond', opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(),
          koppeling_details = coalesce(koppeling_details,'{}'::jsonb) || jsonb_build_object('afgerond_via_beeindiging', coalesce(v_aid::text, 'polis'), 'afgerond_op', now())
    WHERE onderneming_id = o.id AND type = 'opzeggen' AND status = 'nieuw' AND id IS DISTINCT FROM v_aid
    RETURNING id, created_at, polisnummer LOOP
    v_open_ids := v_open_ids || r.id;
    v_open := v_open || E'\n- opzegverzoek van ' || to_char(r.created_at AT TIME ZONE 'Europe/Amsterdam','DD-MM-YYYY') || coalesce(' (' || nullif(r.polisnummer,'') || ')','') || ' afgerond';
  END LOOP;

  v_tekst := 'Beeindigd per ' || to_char(_einddatum,'DD-MM-YYYY') || E'\nReden: ' || v_label || E'\nToelichting: ' || btrim(_toelichting) || v_regels || v_open;
  v_notitie := public.crm_notitie_toevoegen(o.id, _persoon_id, 'stop', v_tekst,
    jsonb_build_object('aanvraag_id', v_aid, 'einddatum', _einddatum, 'reden', _reden, 'credits', credits, 'afgeronde_opzegverzoeken', to_jsonb(v_open_ids)));
  RETURN jsonb_build_object('ok', true, 'aanvraag_id', v_aid, 'notitie_id', v_notitie, 'contracten', n, 'polissen', np, 'credits', credits, 'afgeronde_opzegverzoeken', to_jsonb(v_open_ids));
END $function$;

-- Einddatum wijzigen: alleen supervisor/admin, verplichte reden, geaudit. Creditnota's die al in Exact staan blokkeren de wijziging.
CREATE OR REPLACE FUNCTION public.crm_einddatum_wijzigen(_contract_id uuid, _einddatum date, _reden text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.klant_contracten; v_notitie uuid; v_cred int;
BEGIN
  IF NOT (public.is_team_member(auth.uid()) AND public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'reden is verplicht'; END IF;
  SELECT * INTO r FROM public.klant_contracten WHERE id = _contract_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  IF r.eind_datum IS NULL THEN RAISE EXCEPTION 'contract heeft geen einddatum; gebruik Beeindigen'; END IF;
  IF _einddatum IS NULL OR _einddatum > (now() AT TIME ZONE 'Europe/Amsterdam')::date + 366 THEN RAISE EXCEPTION 'ongeldige einddatum'; END IF;
  IF EXISTS (SELECT 1 FROM public.factuur_credit_planning WHERE klant_contract_id = r.id AND status IN ('geclaimd','concept_aangemaakt','verwerkt','te_laat')) THEN
    RAISE EXCEPTION 'er staat al een creditnota in Exact voor dit contract; einddatum niet gewijzigd';
  END IF;
  UPDATE public.klant_contracten SET eind_datum = _einddatum,
    afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(r.eind_datum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY'))
   WHERE id = r.id;
  UPDATE public.factuur_credit_planning SET einddatum = _einddatum, credit_vanaf = _einddatum + 1, bedrag = NULL, berekening = NULL
   WHERE klant_contract_id = r.id AND status IN ('te_maken','geblokkeerd','fout');
  GET DIAGNOSTICS v_cred = ROW_COUNT;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_contracten', r.id, 'einddatum_gewijzigd', 'eind_datum', r.eind_datum::text, _einddatum::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('reden', _reden, 'creditregels_bijgewerkt', v_cred));
  v_notitie := public.crm_notitie_toevoegen(r.onderneming_id, NULL, 'stop',
    'Einddatum contractregel ' || r.bron_rij || ' gewijzigd van ' || to_char(r.eind_datum,'DD-MM-YYYY') || ' naar ' || to_char(_einddatum,'DD-MM-YYYY') || E'\nReden: ' || btrim(_reden)
    || CASE WHEN v_cred > 0 THEN E'\nCreditnotavoorstel wordt bij de volgende planner-run opnieuw berekend.' ELSE '' END,
    jsonb_build_object('contract_id', r.id, 'oud', r.eind_datum, 'nieuw', _einddatum));
  RETURN jsonb_build_object('ok', true, 'notitie_id', v_notitie, 'creditregels_bijgewerkt', v_cred);
END $function$;
REVOKE ALL ON FUNCTION public.crm_einddatum_wijzigen(uuid, date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_einddatum_wijzigen(uuid, date, text) TO authenticated;

-- Lead als test markeren of terugzetten. Rol verzekering/supervisor/admin, verplichte reden, gelogd in activiteiten_log.
CREATE OR REPLACE FUNCTION public.zet_lead_test(_lead_id uuid, _is_test boolean, _reden text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l public.leads; v_naam text; v_pol int; v_inv int; v_act int; v_conc int;
BEGIN
  IF NOT (public.is_team_member(auth.uid()) AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'))) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  IF length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'reden is verplicht'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'lead niet gevonden'; END IF;
  IF l.is_test = _is_test THEN RETURN jsonb_build_object('ok', true, 'ongewijzigd', true); END IF;
  UPDATE public.leads SET is_test = _is_test WHERE id = l.id;
  UPDATE public.policies SET is_test = _is_test WHERE lead_id = l.id; GET DIAGNOSTICS v_pol = ROW_COUNT;
  UPDATE public.invoices SET is_test = _is_test WHERE lead_id = l.id; GET DIAGNOSTICS v_inv = ROW_COUNT;
  UPDATE public.aanvraag_concepten SET is_test = _is_test WHERE lead_id = l.id; GET DIAGNOSTICS v_conc = ROW_COUNT;
  UPDATE public.activiteiten_log SET is_test = _is_test WHERE lead_id = l.id; GET DIAGNOSTICS v_act = ROW_COUNT;
  SELECT coalesce(full_name, 'teamlid') INTO v_naam FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email, is_test)
  VALUES (CASE WHEN _is_test THEN 'gemarkeerd_als_test' ELSE 'test_markering_verwijderd' END,
    CASE WHEN _is_test THEN 'Gemarkeerd als test' ELSE 'Testmarkering verwijderd' END || '. Reden: ' || btrim(_reden),
    auth.uid(), coalesce(v_naam,'teamlid'), l.id, l.email, _is_test);
  RETURN jsonb_build_object('ok', true, 'is_test', _is_test, 'polissen', v_pol, 'facturen', v_inv, 'concepten', v_conc, 'activiteiten', v_act);
END $function$;
REVOKE ALL ON FUNCTION public.zet_lead_test(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.zet_lead_test(uuid, boolean, text) TO authenticated;

-- Dossier: gebeurtenissen die het team niet rechtstreeks mag lezen (factuurplanning, mails) plus certificaten, aanvragen, ondernemingswijzigingen.
CREATE OR REPLACE FUNCTION public.crm_dossier(_ond uuid[], _pers uuid[])
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pers uuid[]; v_leads uuid[]; v_mails text[]; uit jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  _ond := coalesce(_ond, '{}'); _pers := coalesce(_pers, '{}');
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_pers FROM (
    SELECT unnest(_pers) x UNION SELECT persoon_id FROM public.persoon_onderneming WHERE onderneming_id = ANY(_ond)) s;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_leads FROM (
    SELECT bron_id x FROM public.persoon_bron_koppeling WHERE bron_tabel = 'leads' AND persoon_id = ANY(v_pers)
    UNION SELECT l.id FROM public.leads l JOIN public.ondernemingen o ON o.exact_relatie_code = l.exact_relatie_code WHERE o.id = ANY(_ond)) s;
  SELECT coalesce(array_agg(DISTINCT lower(m)), '{}') INTO v_mails FROM (
    SELECT genormaliseerd_email m FROM public.personen WHERE id = ANY(v_pers)
    UNION SELECT email FROM public.leads WHERE id = ANY(v_leads)) s WHERE m IS NOT NULL AND m <> '';

  SELECT coalesce(jsonb_agg(e ORDER BY e->>'datum' DESC), '[]'::jsonb) INTO uit FROM (
    SELECT jsonb_build_object('key','ld'||l.id, 'datum', l.created_at, 'door', 'klant', 'type', 'aanvraag',
      'onderwerp', 'Aanvraag ' || coalesce(l.gekozen_pakket, l.verzekering_type, l.type::text) || coalesce(' (' || l.bedrijfsnaam || ')',''), 'href', '/admin/leads/' || l.id, 'is_test', l.is_test) e
      FROM public.leads l WHERE l.id = ANY(v_leads)
    UNION ALL
    SELECT jsonb_build_object('key','pu'||p.id, 'datum', coalesce(p.issued_date::timestamptz, p.created_at), 'door', coalesce(nullif(p.issued_by,''),'systeem'), 'type', 'certificaat',
      'onderwerp', 'Certificaat ' || coalesce(p.certificate_number,'zonder nummer') || ' uitgegeven' || coalesce(' (' || p.package_type || ')',''), 'is_test', p.is_test)
      FROM public.policies p WHERE p.onderneming_id = ANY(_ond) OR p.lead_id = ANY(v_leads)
    UNION ALL
    SELECT jsonb_build_object('key','pi'||p.id, 'datum', p.ingetrokken_op, 'door', coalesce((SELECT full_name FROM public.profiles WHERE id = p.ingetrokken_door),'medewerker'), 'type', 'certificaat',
      'onderwerp', 'Certificaat ' || coalesce(p.certificate_number,'zonder nummer') || ' ingetrokken: ' || coalesce(p.intrek_reden,''), 'is_test', p.is_test)
      FROM public.policies p WHERE (p.onderneming_id = ANY(_ond) OR p.lead_id = ANY(v_leads)) AND p.ingetrokken_op IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('key','kc'||kc.id, 'datum', kc.aanvraagdatum::timestamptz, 'door', 'systeem', 'type', 'certificaat',
      'onderwerp', 'Certificaat ' || kc.certificaatnummer || ' (oud systeem' || coalesce(', ' || kc.pakket,'') || ')', 'is_test', kc.is_test)
      FROM public.klant_certificaten kc WHERE kc.onderneming_id = ANY(_ond) AND kc.koppeling_status = 'bevestigd'
    UNION ALL
    SELECT jsonb_build_object('key','fp'||f.id, 'datum', coalesce(f.invoice_date::timestamptz, f.concept_op, f.aangemaakt_op), 'door', 'systeem', 'type', 'factuur',
      'onderwerp', 'Factuur ' || coalesce(f.exact_invoice_number, '(nog geen nummer)') || ' periode ' || to_char(f.periode_start,'DD-MM-YYYY') || ' t/m ' || to_char(f.periode_eind,'DD-MM-YYYY')
        || ', EUR ' || to_char(f.bedrag,'FM999990D00') || ', status ' || f.status, 'is_test', f.is_test)
      FROM public.factuur_planning f JOIN public.klant_contracten k ON k.id = f.klant_contract_id WHERE k.onderneming_id = ANY(_ond)
    UNION ALL
    SELECT jsonb_build_object('key','li'||l.id, 'datum', l.exact_invoice_created_at, 'door', 'systeem', 'type', 'factuur',
      'onderwerp', 'Eerste factuur ' || coalesce(l.exact_invoice_number,'') || coalesce(', EUR ' || to_char(l.exact_invoice_amount,'FM999990D00'),''), 'is_test', l.is_test)
      FROM public.leads l WHERE l.id = ANY(v_leads) AND l.exact_invoice_created_at IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('key','cr'||c.id, 'datum', coalesce(c.verwerkt_op, c.concept_op, c.aangemaakt_op), 'door', 'systeem', 'type', 'creditnota',
      'onderwerp', 'Creditnota ' || to_char(c.credit_vanaf,'DD-MM-YYYY') || ' t/m ' || to_char(c.credit_tm,'DD-MM-YYYY')
        || coalesce(', EUR ' || to_char(c.bedrag,'FM999990D00'), ', bedrag nog niet berekend') || ': '
        || CASE c.status WHEN 'te_maken' THEN 'gepland, nog niet in Exact' WHEN 'geclaimd' THEN 'wordt nu in Exact aangemaakt'
             WHEN 'concept_aangemaakt' THEN 'concept in Exact' || coalesce(' nr ' || c.exact_invoice_number,'')
             WHEN 'verwerkt' THEN 'verwerkt in Exact' || coalesce(' nr ' || c.exact_invoice_number,'')
             WHEN 'niet_nodig' THEN 'niet nodig' WHEN 'geblokkeerd' THEN 'geblokkeerd, niet in Exact' || coalesce(' (' || c.melding || ')','')
             WHEN 'fout' THEN 'fout, niet in Exact' || coalesce(' (' || left(c.foutmelding,120) || ')','') ELSE c.status END,
      'status', c.status, 'is_test', c.is_test)
      FROM public.factuur_credit_planning c JOIN public.klant_contracten k ON k.id = c.klant_contract_id WHERE k.onderneming_id = ANY(_ond)
    UNION ALL
    SELECT jsonb_build_object('key','m'||m.message_id, 'datum', m.created_at, 'door', 'systeem', 'type', 'mail',
      'onderwerp', 'Mail ' || replace(m.template_name,'_',' ') || ' aan ' || m.recipient_email || ' (' || m.status || ')', 'is_test', false)
      FROM (SELECT DISTINCT ON (coalesce(message_id, id::text)) * FROM public.email_send_log
            WHERE lower(recipient_email) = ANY(v_mails) ORDER BY coalesce(message_id, id::text), created_at DESC) m
    UNION ALL
    SELECT jsonb_build_object('key','ov'||v.id, 'datum', v.vastgelegd_op, 'door', coalesce((SELECT full_name FROM public.profiles WHERE id = v.vastgelegd_door),'medewerker'), 'type', 'ondernemingswijziging',
      'onderwerp', 'Ondernemingswijziging (' || v.soort || ') ' || coalesce(ov.naam,'?') || ' naar ' || coalesce(nv.naam,'?') || ' per ' || to_char(v.ingangsdatum,'DD-MM-YYYY'), 'is_test', v.is_test)
      FROM public.onderneming_opvolging v LEFT JOIN public.ondernemingen ov ON ov.id = v.van_onderneming_id LEFT JOIN public.ondernemingen nv ON nv.id = v.naar_onderneming_id
      WHERE v.van_onderneming_id = ANY(_ond) OR v.naar_onderneming_id = ANY(_ond)
  ) s WHERE e->>'datum' IS NOT NULL;
  RETURN uit;
END $function$;
REVOKE ALL ON FUNCTION public.crm_dossier(uuid[], uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_dossier(uuid[], uuid[]) TO authenticated;