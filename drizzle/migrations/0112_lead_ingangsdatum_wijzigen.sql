CREATE OR REPLACE FUNCTION public.bron_rij_voor_lead(_id uuid) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE h bigint := 0; s text := replace(_id::text,'-',''); i int;
BEGIN
  FOR i IN 1..length(s) LOOP
    h := (h * 31 + ascii(substr(s,i,1))) % 4294967296;
    IF h >= 2147483648 THEN h := h - 4294967296; END IF;
  END LOOP;
  RETURN (abs(h) % 2000000000) + 100000;
END $$;

CREATE OR REPLACE FUNCTION public.lead_ingangsdatum_wijzigen(_lead_id uuid, _datum date, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l public.leads; oud date; delta int; naam text; nieuw_starter boolean; was_starter boolean;
  starter_wijziging text := NULL; n_contract int := 0; n_polis int := 0; waarschuwingen text[] := '{}';
  nieuw_tot date; cyber_nieuw date; cyber_eind_nieuw date;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _datum IS NULL THEN RAISE EXCEPTION 'datum ontbreekt'; END IF;
  IF length(trim(coalesce(_toelichting,''))) < 3 OR length(_toelichting) > 500 THEN RAISE EXCEPTION 'toelichting verplicht (3-500 tekens)'; END IF;
  SELECT * INTO l FROM public.leads WHERE id=_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  oud := l.ingangsdatum;
  IF oud IS NOT DISTINCT FROM _datum THEN RAISE EXCEPTION 'datum is ongewijzigd'; END IF;
  delta := CASE WHEN oud IS NULL THEN 0 ELSE _datum - oud END;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());

  -- cyber meegekocht: ingangsdatum schuift mee als die gelijk liep
  cyber_nieuw := l.cyber_ingangsdatum; cyber_eind_nieuw := l.cyber_einddatum;
  IF l.cyber_ingangsdatum IS NOT NULL AND l.cyber_ingangsdatum = oud THEN
    cyber_nieuw := _datum; cyber_eind_nieuw := CASE WHEN l.cyber_einddatum IS NULL THEN NULL ELSE l.cyber_einddatum + delta END;
  END IF;

  -- starter opnieuw berekenen (alleen als starter is aangevraagd/goedgekeurd)
  was_starter := l.tarief_type = 'starter';
  nieuw_tot := l.starter_tot;
  IF l.tarief_type = 'starter' OR l.starter_controle_status IS NOT NULL THEN
    nieuw_starter := l.kvk_startdatum IS NOT NULL AND l.kvk_startdatum <= _datum AND _datum < (l.kvk_startdatum + interval '12 months')::date;
    IF nieuw_starter THEN
      nieuw_tot := (_datum + interval '12 months')::date - 1;
      IF was_starter AND nieuw_tot IS DISTINCT FROM l.starter_tot THEN starter_wijziging := 'Startertarief loopt nu tot ' || to_char(nieuw_tot,'DD-MM-YYYY'); END IF;
      IF NOT was_starter AND l.starter_controle_status='afgewezen' THEN starter_wijziging := 'Met deze datum zou de klant wel starter zijn (KVK ' || coalesce(to_char(l.kvk_startdatum,'DD-MM-YYYY'),'?') || '); startertarief blijft afgewezen, beoordeel zo nodig opnieuw'; END IF;
    ELSE
      nieuw_tot := NULL;
      IF was_starter OR l.starter_controle_status='te_controleren' THEN
        starter_wijziging := 'Met deze datum is de KVK-inschrijving ouder dan 12 maanden (of onbekend): startertarief vervalt, gewoon tarief geldt';
      END IF;
    END IF;
  END IF;

  PERFORM set_config('zp.starter_rpc','1',true);
  PERFORM set_config('zp.cyber_datums','1',true);
  UPDATE public.leads SET ingangsdatum=_datum, cyber_ingangsdatum=cyber_nieuw, cyber_einddatum=cyber_eind_nieuw,
    starter_tot = nieuw_tot,
    tarief_type = CASE WHEN nieuw_tot IS NULL AND tarief_type='starter' THEN 'standaard' ELSE tarief_type END,
    starter_controle_status = CASE WHEN nieuw_tot IS NULL AND starter_controle_status IN ('te_controleren','goedgekeurd') THEN 'afgewezen' ELSE starter_controle_status END,
    starter_toelichting = CASE WHEN nieuw_tot IS NULL AND starter_controle_status IN ('te_controleren','goedgekeurd') THEN 'Automatisch na wijziging ingangsdatum naar ' || to_char(_datum,'DD-MM-YYYY') ELSE starter_toelichting END
  WHERE id=_lead_id;
  UPDATE public.bav_aanmeldingen SET ingangsdatum=_datum, starter_tot=nieuw_tot,
    tarief_type = CASE WHEN nieuw_tot IS NULL AND tarief_type='starter' THEN 'standaard' ELSE tarief_type END WHERE lead_id=_lead_id;

  -- CRM-contracten (BAV via bronsleutel, cyber via cyber_lead_id)
  UPDATE public.klant_contracten SET begin_datum=_datum, factureren_vanaf=_datum,
    starter_tot = CASE WHEN tarief_type='starter' THEN nieuw_tot ELSE starter_tot END,
    tarief_type = CASE WHEN tarief_type='starter' AND nieuw_tot IS NULL THEN 'standaard' ELSE tarief_type END
  WHERE bron='site_activatie' AND bron_rij=public.bron_rij_voor_lead(_lead_id) AND product='bav_avb';
  GET DIAGNOSTICS n_contract = ROW_COUNT;
  IF cyber_nieuw IS DISTINCT FROM l.cyber_ingangsdatum THEN
    UPDATE public.klant_contracten SET begin_datum=cyber_nieuw, factureren_vanaf=cyber_nieuw, cyber_ingangsdatum=cyber_nieuw,
      cyber_einddatum=coalesce(cyber_eind_nieuw, cyber_einddatum)
    WHERE cyber_lead_id=_lead_id AND product='cyber_clear';
    n_contract := n_contract + (SELECT count(*) FROM public.klant_contracten WHERE cyber_lead_id=_lead_id AND product='cyber_clear');
  END IF;
  IF n_contract > 0 AND EXISTS (SELECT 1 FROM public.klant_contracten WHERE ((bron='site_activatie' AND bron_rij=public.bron_rij_voor_lead(_lead_id)) OR cyber_lead_id=_lead_id) AND gefactureerd_tm IS NOT NULL) THEN
    waarschuwingen := waarschuwingen || 'Het contract heeft al een gefactureerde periode; controleer in Facturatieplanning of de periodes kloppen'::text;
  END IF;

  UPDATE public.policies SET start_date=_datum WHERE lead_id=_lead_id AND coalesce(status,'') <> 'ingetrokken';
  GET DIAGNOSTICS n_polis = ROW_COUNT;
  IF n_polis > 0 THEN waarschuwingen := waarschuwingen || 'Er is al een certificaat; maak het opnieuw via Certificaat aanpassen zodat de pdf de nieuwe datum toont'::text; END IF;
  IF l.exact_invoice_id IS NOT NULL THEN waarschuwingen := array_prepend('Er staat al een factuur in Exact, controleer die handmatig'::text, waarschuwingen); END IF;

  INSERT INTO public.sensitive_audit_log (target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol)
  VALUES ('leads',_lead_id,'ingangsdatum_gewijzigd','ingangsdatum',oud::text,_datum::text,auth.uid(),public.get_user_role_label(auth.uid()));
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
  VALUES ('ingangsdatum_gewijzigd',
    'Ingangsdatum gewijzigd van ' || coalesce(to_char(oud,'DD-MM-YYYY'),'leeg') || ' naar ' || to_char(_datum,'DD-MM-YYYY') || ': ' || trim(_toelichting)
      || CASE WHEN starter_wijziging IS NOT NULL THEN '. ' || starter_wijziging ELSE '' END,
    auth.uid(), naam, _lead_id, lower(l.email), l.is_test);
  UPDATE public.leads SET activatie_log = coalesce(activatie_log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'tijd', now(), 'actie','ingangsdatum_gewijzigd', 'oud', oud, 'nieuw', _datum, 'door', auth.uid(), 'door_naam', naam,
    'toelichting', trim(_toelichting), 'starter', starter_wijziging, 'contracten', n_contract, 'polissen', n_polis))
  WHERE id=_lead_id AND (activatie_log IS NULL OR jsonb_typeof(activatie_log)='array');
  PERFORM set_config('zp.starter_rpc','0',true);
  PERFORM set_config('zp.cyber_datums','0',true);
  RETURN jsonb_build_object('oud',oud,'nieuw',_datum,'starter_wijziging',starter_wijziging,'contracten',n_contract,'polissen',n_polis,'waarschuwingen',to_jsonb(waarschuwingen));
END $$;

REVOKE ALL ON FUNCTION public.lead_ingangsdatum_wijzigen(uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_ingangsdatum_wijzigen(uuid,date,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.bron_rij_voor_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bron_rij_voor_lead(uuid) TO authenticated, service_role;

-- Direct wijzigen van ingangsdatum buiten de RPC: alleen supervisor/admin/verzekering (en service_role)
CREATE OR REPLACE FUNCTION public.guard_lead_ingangsdatum() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.ingangsdatum IS NOT DISTINCT FROM OLD.ingangsdatum THEN RETURN NEW; END IF;
  IF coalesce(auth.role(),'')='service_role' OR current_user IN ('postgres','supabase_admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF current_setting('zp.starter_rpc',true)='1' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Ingangsdatum wijzigen kan alleen via Ingangsdatum aanpassen';
END $$;
DROP TRIGGER IF EXISTS trg_guard_lead_ingangsdatum ON public.leads;
CREATE TRIGGER trg_guard_lead_ingangsdatum BEFORE UPDATE OF ingangsdatum ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_lead_ingangsdatum();