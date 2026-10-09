ALTER TABLE public.klant_contracten DROP CONSTRAINT klant_contracten_status_check;
ALTER TABLE public.klant_contracten ADD CONSTRAINT klant_contracten_status_check CHECK (status = ANY (ARRAY['actief','loopt_af','vervangen','einddatum_controle']));

-- Geregistreerde opzegging: opzegverzoek (niet test) bij de klant, of beeindiging/verwerking in de audit, of cyber-lifecycle vanuit een lead.
CREATE OR REPLACE FUNCTION public.heeft_geregistreerde_opzegging(_contract_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM klant_contracten k WHERE k.id = _contract_id AND (
    k.cyber_lead_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM klant_service_aanvragen s WHERE s.type = 'opzeggen' AND NOT s.is_test AND s.onderneming_id = k.onderneming_id)
    OR EXISTS (SELECT 1 FROM sensitive_audit_log a WHERE a.target_table = 'klant_contracten' AND a.target_id = k.id
               AND a.actie IN ('handmatig_beeindigd','opzegging_verwerkt','einddatum_opzegging_bevestigd'))));
$$;
REVOKE ALL ON FUNCTION public.heeft_geregistreerde_opzegging(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heeft_geregistreerde_opzegging(uuid) TO authenticated, service_role;

-- Statuslijsten uitbreiden zodat einddatum_controle overal als lopend contract telt.
DO $do$
DECLARE f text; d text; n text;
BEGIN
  FOREACH f IN ARRAY ARRAY['facturatie_kandidaten','dashboard_tellers','bepaal_opzegging_koppeling','crm_ondernemingswijziging','verwerk_opzegging','doorrol_startstand'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname='public' AND p.proname = f;
    n := replace(d, '(''actief'',''loopt_af'')', '(''actief'',''loopt_af'',''einddatum_controle'')');
    IF f = 'facturatie_kandidaten' THEN
      n := replace(n, 'WHEN p.ob IS NOT NULL THEN coalesce(p.obr, p.ob)', 'WHEN p.status = ''einddatum_controle'' THEN ''einddatum controleren door Ellen''
           WHEN p.ob IS NOT NULL THEN coalesce(p.obr, p.ob)');
      n := replace(n, 'WHEN p.ob IS NOT NULL THEN ''conflict''', 'WHEN p.status = ''einddatum_controle'' THEN ''einddatum''
           WHEN p.ob IS NOT NULL THEN ''conflict''');
      IF n NOT LIKE '%einddatum controleren door Ellen%' THEN RAISE EXCEPTION 'facturatie_kandidaten niet aangepast'; END IF;
    END IF;
    IF n = d THEN RAISE EXCEPTION 'functie % niet aangepast', f; END IF;
    EXECUTE n;
  END LOOP;
END $do$;

-- Lijst voor Vandaag te doen en de ochtendcontrole.
CREATE OR REPLACE FUNCTION public.einddatum_zonder_opzegging()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('contract_id', k.id, 'id', k.onderneming_id, 'naam', o.naam, 'abonnement_nr', k.abonnement_nr,
      'product', k.product, 'cyclus', k.cyclus, 'bedrag', round(k.bedrag_per_periode * k.aantal, 2), 'eind_datum', k.eind_datum,
      'volgende_factuurdatum', k.volgende_factuurdatum, 'status', k.status) ORDER BY k.volgende_factuurdatum NULLS LAST, o.naam)
    FROM klant_contracten k JOIN ondernemingen o ON o.id = k.onderneming_id
    WHERE NOT k.is_test AND NOT o.is_test AND k.status <> 'vervangen' AND k.eind_datum IS NOT NULL
      AND NOT public.heeft_geregistreerde_opzegging(k.id)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.einddatum_zonder_opzegging() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.einddatum_zonder_opzegging() TO authenticated, service_role;

-- Beslissing van Ellen: opzegging bevestigen of loopt door.
CREATE OR REPLACE FUNCTION public.einddatum_controle_beslissen(_contract_id uuid, _keuze text, _opzegdatum date, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k klant_contracten; res jsonb; v_notitie uuid;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _keuze NOT IN ('opzegging','loopt_door') THEN RAISE EXCEPTION 'ongeldige keuze'; END IF;
  IF length(btrim(coalesce(_toelichting,''))) < 3 THEN RAISE EXCEPTION 'toelichting is verplicht'; END IF;
  SELECT * INTO k FROM klant_contracten WHERE id = _contract_id FOR UPDATE;
  IF k.id IS NULL THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  IF k.status <> 'einddatum_controle' THEN RAISE EXCEPTION 'contract staat niet op einddatum controleren'; END IF;

  IF _keuze = 'opzegging' THEN
    IF _opzegdatum IS NULL THEN RAISE EXCEPTION 'opzegdatum is verplicht'; END IF;
    UPDATE klant_contracten SET status = 'actief', eind_datum = NULL WHERE id = k.id;
    res := public.crm_beeindig(k.onderneming_id, ARRAY[k.id], ARRAY[]::uuid[], _opzegdatum, 'eerdere_opzegging',
      'Einddatum AFAS gecontroleerd, opzegging bevestigd. ' || btrim(_toelichting), NULL);
    INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('klant_contracten', k.id, 'einddatum_opzegging_bevestigd', 'eind_datum/status',
      coalesce(k.eind_datum::text,'-') || ' / einddatum_controle', _opzegdatum::text || ' / loopt_af', auth.uid(), public.get_user_role_label(auth.uid()),
      jsonb_build_object('abonnement_nr', k.abonnement_nr, 'afas_eind_datum', k.eind_datum, 'toelichting', _toelichting, 'beeindiging', res));
    RETURN jsonb_build_object('ok', true, 'keuze', _keuze, 'beeindiging', res);
  END IF;

  UPDATE klant_contracten SET status = 'actief', eind_datum = NULL,
    afwijkingen = array_append(coalesce(afwijkingen,'{}'), 'einddatum AFAS ' || to_char(k.eind_datum,'DD-MM-YYYY') || ' vervallen: loopt door')
   WHERE id = k.id;
  INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_contracten', k.id, 'einddatum_loopt_door', 'eind_datum/status',
    coalesce(k.eind_datum::text,'-') || ' / einddatum_controle', '- / actief', auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('abonnement_nr', k.abonnement_nr, 'afas_eind_datum', k.eind_datum, 'volgende_factuurdatum', k.volgende_factuurdatum, 'toelichting', _toelichting));
  v_notitie := public.crm_notitie_toevoegen(k.onderneming_id, NULL, 'notitie',
    'Contract ' || coalesce(k.abonnement_nr,'') || ' (' || k.product || ') loopt door. Einddatum uit AFAS (' || to_char(k.eind_datum,'DD-MM-YYYY')
    || ') vervallen, er is geen opzegging. Volgende factuurdatum ' || coalesce(to_char(k.volgende_factuurdatum,'DD-MM-YYYY'),'onbekend') || E'.\nToelichting: ' || btrim(_toelichting),
    jsonb_build_object('contract_id', k.id, 'keuze', 'loopt_door'));
  RETURN jsonb_build_object('ok', true, 'keuze', _keuze, 'notitie_id', v_notitie);
END $$;
REVOKE ALL ON FUNCTION public.einddatum_controle_beslissen(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.einddatum_controle_beslissen(uuid, text, date, text) TO authenticated;

-- Vandaag te doen: categorie einddatum_controle.
DO $do$
DECLARE d text; n text;
BEGIN
  SELECT pg_get_functiondef('public.mijn_acties_vandaag'::regproc) INTO d;
  n := replace(d, '  RETURN r || jsonb_build_object(', $blk$  WITH b AS (
    SELECT k.*, o.naam onaam FROM klant_contracten k JOIN ondernemingen o ON o.id = k.onderneming_id
     WHERE k.status = 'einddatum_controle' AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', onderneming_id, 'contract_id', id, 'naam', onaam, 'abonnement_nr', abonnement_nr,
        'product', product, 'cyclus', cyclus, 'bedrag', round(bedrag_per_periode * aantal, 2), 'eind_datum', eind_datum,
        'volgende_factuurdatum', volgende_factuurdatum) ORDER BY volgende_factuurdatum NULLS LAST, onaam) FROM b), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('einddatum_controle', c);

  RETURN r || jsonb_build_object($blk$);
  n := replace(n, '''facturatie'',''starter'']', '''facturatie'',''starter'',''einddatum_controle'']');
  IF n = d OR n NOT LIKE '%''starter'',''einddatum_controle'']%' THEN RAISE EXCEPTION 'mijn_acties_vandaag niet aangepast'; END IF;
  EXECUTE n;
END $do$;