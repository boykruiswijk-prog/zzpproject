ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.klant_contracten(id), ADD COLUMN IF NOT EXISTS geactiveerd_op timestamptz, ADD COLUMN IF NOT EXISTS certificaat_pad text, ADD COLUMN IF NOT EXISTS certificaat_versie integer, ADD COLUMN IF NOT EXISTS mail_status text NOT NULL DEFAULT 'wacht', ADD COLUMN IF NOT EXISTS mail_claim_op timestamptz;
ALTER TABLE public.klant_contracten ADD COLUMN IF NOT EXISTS cyber_toevoeg_verzoek_id uuid REFERENCES public.cyber_toevoeg_verzoeken(id);
CREATE UNIQUE INDEX IF NOT EXISTS cyber_contract_een_per_verzoek ON public.klant_contracten(cyber_toevoeg_verzoek_id) WHERE cyber_toevoeg_verzoek_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cyber_toevoeg_contract_uniek ON public.cyber_toevoeg_verzoeken(contract_id) WHERE contract_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_beoordelen(_id uuid,_akkoord boolean,_notitie text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; p public.policies%ROWTYPE; b public.klant_contracten%ROWTYPE; o public.ondernemingen%ROWTYPE; m public.factuur_artikel_mapping%ROWTYPE; v_cyclus text; v_item text; v_contract uuid; v_start date; v_eind date; v_status text;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'Teamtoegang met tweestapsverificatie vereist' USING ERRCODE='42501'; END IF;
 IF _akkoord IS NULL OR _notitie IS NULL OR length(btrim(_notitie))<10 OR length(_notitie)>1000 THEN RAISE EXCEPTION 'Toelichting vereist (10 tot 1000 tekens)'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Verzoek niet gevonden'; END IF;
 IF r.geactiveerd_op IS NOT NULL THEN IF NOT _akkoord THEN RAISE EXCEPTION 'Actief verzoek kan niet worden afgewezen'; END IF; RETURN 'actief'; END IF;
 IF r.status='afgewezen' THEN IF _akkoord THEN RAISE EXCEPTION 'Verzoek is afgewezen'; END IF; RETURN 'afgewezen'; END IF;
 IF r.status NOT IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie') THEN RAISE EXCEPTION 'Verzoek is niet in beoordeling'; END IF;
 IF _akkoord THEN
  SELECT * INTO p FROM public.policies WHERE id=r.policy_id FOR UPDATE;
  IF NOT public.cyber_toevoegen_mogelijk(p.id) THEN RAISE EXCEPTION 'Polis is niet meer geschikt voor cyber toevoegen'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id=p.onderneming_id;
  IF o.id IS NULL OR o.is_test IS DISTINCT FROM r.is_test OR p.is_test IS DISTINCT FROM r.is_test THEN RAISE EXCEPTION 'Klantkoppeling ontbreekt of testmarkering wijkt af'; END IF;
  SELECT * INTO b FROM public.klant_contracten WHERE onderneming_id=o.id AND product='bav_avb' AND status IN ('actief','loopt_af') AND begin_datum <= (now() AT TIME ZONE 'Europe/Amsterdam')::date AND (public.contract_opzegging(id) IS NULL OR public.contract_opzegging(id) >= (now() AT TIME ZONE 'Europe/Amsterdam')::date) ORDER BY created_at DESC LIMIT 1;
  IF b.id IS NOT NULL THEN v_cyclus:=b.cyclus; ELSE SELECT CASE WHEN gekozen_pakket='jaarlijks' THEN 'jaar' WHEN gekozen_pakket='maandelijks' THEN 'maand' END INTO v_cyclus FROM public.leads WHERE id=r.lead_id; END IF;
  IF v_cyclus NOT IN ('maand','jaar') OR v_cyclus IS NULL THEN RAISE EXCEPTION 'Betaalwijze BAV ontbreekt'; END IF;
  v_item:=CASE WHEN v_cyclus='jaar' THEN '102J' ELSE '102M' END;
  m:=public.factuur_mapping_voor(v_item);
  IF m.id IS NULL OR NOT m.bevestigd OR m.exact_item_id IS NULL OR m.blokkade_reden IS NOT NULL OR m.product<>'cyber_clear' OR m.gl_code IS DISTINCT FROM '8003' OR m.btw_code IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Bevestigde cyberartikelkoppeling ontbreekt'; END IF;
  IF NOT r.is_test AND (o.exact_account_id IS NULL OR o.facturatie_blokkade IS NOT NULL) THEN RAISE EXCEPTION 'Facturatiekoppeling klant ontbreekt of is geblokkeerd'; END IF;
  v_start:=r.gewenste_ingangsdatum; v_eind:=public.factuur_periode_eind(v_start,'jaar');
  IF v_start IS NULL OR r.voorwaarden_versie<>'2026-10-08' OR r.antwoorden <> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb THEN RAISE EXCEPTION 'Cybervoorwaarden ongeldig'; END IF;
  INSERT INTO public.klant_contracten(onderneming_id,bron,bron_rij,type,itemcode,product,cyclus,aantal,bedrag_per_periode,begin_datum,factureren_vanaf,gefactureerd_tm,volgende_factuurdatum,gefactureerd_tm_bron,status,facturatie_status,cyber_voorwaarden_versie,cyber_ingangsdatum,cyber_einddatum,cyber_toevoeg_verzoek_id,is_test)
  VALUES(o.id,'site_cyber_toevoegen',public.bron_rij_voor_lead(r.id)::integer,'verzekering',v_item,'cyber_clear',v_cyclus,1,CASE WHEN v_cyclus='jaar' THEN 250 ELSE 27.50 END,v_start,v_start,NULL,v_start,'site_cyber_toevoegen','actief','planner','2026-10-08',v_start,v_eind,r.id,r.is_test) RETURNING id INTO v_contract;
  UPDATE public.cyber_toevoeg_verzoeken SET contract_id=v_contract,geactiveerd_op=now() WHERE id=r.id;
  v_status:='akkoord_wacht_op_activatie';
 ELSE v_status:='afgewezen'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET status=v_status,beoordeling_notitie=btrim(_notitie),beoordeeld_door=auth.uid(),beoordeeld_op=now() WHERE id=r.id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_beoordeeld','Cyberverzoek '||r.id||': '||CASE WHEN _akkoord THEN 'actief, aparte cyberfacturatie' ELSE 'afgewezen' END||'. '||btrim(_notitie),auth.uid(),r.lead_id,r.is_test);
 RETURN CASE WHEN _akkoord THEN 'actief' ELSE 'afgewezen' END;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_mail_claim(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET mail_status='geclaimd',mail_claim_op=now() WHERE id=_id AND geactiveerd_op IS NOT NULL AND NOT is_test AND certificaat_pad IS NOT NULL AND mail_status IN ('wacht','niet_verzonden_schakelaar_uit','niet_verzonden_geen_ontvanger','niet_verzonden_tekstfout','niet_verzonden_gate');
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_mail_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_mail_claim(uuid) TO service_role;
COMMENT ON TABLE public.cyber_toevoeg_verzoeken IS 'E4: akkoord activeert atomair een apart cybercontract. Historische status akkoord_wacht_op_activatie blijft compatibel; geactiveerd_op bepaalt actief. Certificaat/mail apart idempotent; geen BAV-mutaties.';