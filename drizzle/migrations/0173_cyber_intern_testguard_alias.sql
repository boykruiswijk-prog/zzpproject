CREATE OR REPLACE FUNCTION public.cyber_toevoegen_activeren_intern(_id uuid, _notitie text, _test boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; p public.policies%ROWTYPE; b public.klant_contracten%ROWTYPE; o public.ondernemingen%ROWTYPE; m public.factuur_artikel_mapping%ROWTYPE; v_cyclus text; v_item text; v_contract uuid; v_start date; v_eind date; v_status text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 IF _notitie IS NULL OR length(btrim(_notitie))<10 OR length(_notitie)>1000 THEN RAISE EXCEPTION 'Toelichting vereist (10 tot 1000 tekens)'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Verzoek niet gevonden'; END IF;
 IF coalesce((SELECT modus FROM public.cyber_activatie_config WHERE id),'uit')='alleen_test' THEN
  IF NOT _test OR NOT r.is_test OR r.beoordeeld_door IS NULL OR r.beoordeeld_op IS NULL OR NOT EXISTS(SELECT 1 FROM public.cyber_e4_testbewijs e WHERE e.verzoek_id=r.id) THEN RAISE EXCEPTION 'Menselijke MFA-beoordeling en E4-testvoorsnapshot vereist' USING ERRCODE='42501'; END IF;
 END IF;
 IF _test THEN
  IF NOT r.is_test OR NOT EXISTS(SELECT 1 FROM public.leads l JOIN public.policies tp ON tp.id=r.policy_id JOIN public.ondernemingen tbo ON tbo.id=r.onderneming_id WHERE l.id=r.lead_id AND tp.lead_id=l.id AND tp.onderneming_id=tbo.id AND l.is_test AND tp.is_test AND tbo.is_test AND lower(l.email) LIKE '%@zpzaken.nl') THEN RAISE EXCEPTION 'testmarkering vereist'; END IF;
 ELSIF r.is_test OR (r.geactiveerd_op IS NULL AND r.status<>'akkoord_wacht_op_activatie') OR r.beoordeeld_door IS NULL THEN RAISE EXCEPTION 'menselijke beoordeling vereist'; END IF;
 IF r.geactiveerd_op IS NOT NULL THEN RETURN 'actief'; END IF;
 IF r.status='afgewezen' THEN RAISE EXCEPTION 'Verzoek is afgewezen'; END IF;
 IF r.status NOT IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie') THEN RAISE EXCEPTION 'Verzoek is niet in beoordeling'; END IF;
 IF NOT _test AND NOT coalesce((SELECT actief FROM public.cyber_activatie_config WHERE id),false) THEN
  UPDATE public.cyber_toevoeg_verzoeken SET status='akkoord_wacht_op_activatie',beoordeling_notitie=btrim(_notitie),beoordeeld_door=coalesce(auth.uid(),r.beoordeeld_door),beoordeeld_op=coalesce(r.beoordeeld_op,now()) WHERE id=r.id;
  RETURN 'akkoord_wacht_op_activatie';
 END IF;
 SELECT * INTO p FROM public.policies WHERE id=r.policy_id FOR UPDATE;
 IF NOT public.cyber_toevoegen_mogelijk(p.id) THEN RAISE EXCEPTION 'Polis is niet meer geschikt voor cyber toevoegen'; END IF;
 SELECT * INTO o FROM public.ondernemingen WHERE id=p.onderneming_id;
 IF o.id IS NULL OR o.is_test IS DISTINCT FROM r.is_test OR p.is_test IS DISTINCT FROM r.is_test THEN RAISE EXCEPTION 'Klantkoppeling ontbreekt of testmarkering wijkt af'; END IF;
 SELECT * INTO b FROM public.klant_contracten WHERE onderneming_id=o.id AND product='bav_avb' AND status IN ('actief','loopt_af') AND begin_datum <= (now() AT TIME ZONE 'Europe/Amsterdam')::date AND (public.contract_opzegging(id) IS NULL OR public.contract_opzegging(id) >= (now() AT TIME ZONE 'Europe/Amsterdam')::date) ORDER BY created_at DESC LIMIT 1;
 IF b.id IS NOT NULL THEN IF _test AND b.is_test IS DISTINCT FROM true THEN RAISE EXCEPTION 'Test-BAV vereist'; END IF; v_cyclus:=b.cyclus; ELSE SELECT CASE WHEN gekozen_pakket='jaarlijks' THEN 'jaar' WHEN gekozen_pakket='maandelijks' THEN 'maand' END INTO v_cyclus FROM public.leads WHERE id=r.lead_id; END IF;
 IF v_cyclus NOT IN ('maand','jaar') OR v_cyclus IS NULL THEN RAISE EXCEPTION 'Betaalwijze BAV ontbreekt'; END IF;
 v_item:=CASE WHEN v_cyclus='jaar' THEN '102J' ELSE '102M' END;
 m:=public.factuur_mapping_voor(v_item);
 IF m.id IS NULL OR NOT m.bevestigd OR m.exact_item_id IS NULL OR m.blokkade_reden IS NOT NULL OR m.product<>'cyber_clear' OR m.gl_code IS DISTINCT FROM '8003' OR m.btw_code IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Bevestigde cyberartikelkoppeling ontbreekt'; END IF;
 IF NOT r.is_test AND (o.exact_account_id IS NULL OR o.facturatie_blokkade IS NOT NULL) THEN RAISE EXCEPTION 'Facturatiekoppeling klant ontbreekt of is geblokkeerd'; END IF;
 v_start:=r.gewenste_ingangsdatum; v_eind:=public.factuur_periode_eind(v_start,'jaar');
 IF v_start IS NULL OR r.voorwaarden_versie<>'2026-10-08' OR r.antwoorden <> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb THEN RAISE EXCEPTION 'Cybervoorwaarden ongeldig'; END IF;
 INSERT INTO public.klant_contracten(onderneming_id,bron,bron_rij,type,itemcode,product,cyclus,aantal,bedrag_per_periode,begin_datum,factureren_vanaf,gefactureerd_tm,volgende_factuurdatum,gefactureerd_tm_bron,status,facturatie_status,cyber_voorwaarden_versie,cyber_ingangsdatum,cyber_einddatum,cyber_toevoeg_verzoek_id,is_test)
 VALUES(o.id,'site_cyber_toevoegen',public.bron_rij_voor_lead(r.id)::integer,'verzekering',v_item,'cyber_clear',v_cyclus,1,CASE WHEN v_cyclus='jaar' THEN 250 ELSE 27.50 END,v_start,v_start,NULL,v_start,'site_cyber_toevoegen','actief','planner','2026-10-08',v_start,v_eind,r.id,r.is_test) RETURNING id INTO v_contract;
 UPDATE public.cyber_toevoeg_verzoeken SET contract_id=v_contract,geactiveerd_op=now(),status='akkoord_wacht_op_activatie',beoordeling_notitie=btrim(_notitie),beoordeeld_door=coalesce(auth.uid(),r.beoordeeld_door),beoordeeld_op=coalesce(r.beoordeeld_op,now()) WHERE id=r.id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_beoordeeld','Cyberverzoek '||r.id||': actief, aparte cyberfacturatie. '||btrim(_notitie),auth.uid(),r.lead_id,r.is_test);
 RETURN 'actief';
END $function$;