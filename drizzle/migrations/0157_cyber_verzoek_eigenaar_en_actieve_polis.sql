CREATE OR REPLACE FUNCTION public.cyber_toevoegen_mogelijk(_policy_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.policies p LEFT JOIN public.leads l ON l.id=p.lead_id
 WHERE p.id=_policy_id AND p.user_id IS NOT NULL AND p.status='geldig' AND p.start_date <= (now() AT TIME ZONE 'Europe/Amsterdam')::date
 AND (l.id IS NULL OR l.status IN ('actief','klant'))
 AND (EXISTS(SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id=p.onderneming_id AND k.product='bav_avb' AND k.status IN ('actief','loopt_af') AND k.begin_datum <= (now() AT TIME ZONE 'Europe/Amsterdam')::date AND (public.contract_opzegging(k.id) IS NULL OR public.contract_opzegging(k.id) >= (now() AT TIME ZONE 'Europe/Amsterdam')::date))
 OR (NOT EXISTS(SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id=p.onderneming_id AND k.product='bav_avb') AND l.status IN ('actief','klant') AND l.gekozen_pakket IN ('maandelijks','jaarlijks')))
 AND p.package_type NOT ILIKE '%cyber%' AND p.package_type NOT ILIKE '%combi%'
 AND NOT EXISTS(SELECT 1 FROM public.leads cl WHERE (cl.id=p.lead_id OR (p.onderneming_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.policies cp WHERE cp.lead_id=cl.id AND cp.onderneming_id=p.onderneming_id))) AND cl.status IN ('actief','klant') AND cl.gekozen_pakket ~ '[-_]cyber$')
 AND NOT EXISTS(SELECT 1 FROM public.klant_contracten ck WHERE ck.product='cyber_clear' AND ck.status IN ('actief','loopt_af') AND (ck.onderneming_id=p.onderneming_id OR ck.cyber_lead_id=p.lead_id)));
$$;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen(_policy_id uuid,_antwoorden jsonb,_ingang date,_akkoord boolean,_notitie text DEFAULT '',_namens_klant boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.policies%ROWTYPE; v_id uuid; team boolean:=public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'); BEGIN
 IF auth.uid() IS NULL OR _namens_klant IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 SELECT * INTO p FROM public.policies WHERE id=_policy_id FOR UPDATE;
 IF p.id IS NULL OR p.user_id IS NULL OR (NOT _namens_klant AND p.user_id IS DISTINCT FROM auth.uid()) OR (_namens_klant AND NOT team) THEN RAISE EXCEPTION 'geen toegang of klantaccount ontbreekt'; END IF;
 IF NOT public.cyber_toevoegen_mogelijk(p.id) THEN RAISE EXCEPTION 'Alleen bij een actieve BAV + AVB zonder cyber'; END IF;
 IF _akkoord IS DISTINCT FROM true THEN RAISE EXCEPTION 'Akkoord is verplicht'; END IF;
 IF _ingang IS NULL OR _ingang < (now() AT TIME ZONE 'Europe/Amsterdam')::date+1 THEN RAISE EXCEPTION 'De ingangsdatum is vroegst morgen'; END IF;
 IF _antwoorden IS NULL OR jsonb_typeof(_antwoorden) <> 'object' OR _antwoorden <> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb THEN RAISE EXCEPTION 'Beantwoord alle cybervragen en voldoe aan de voorwaarden'; END IF;
 IF _notitie IS NULL OR length(_notitie)>1000 OR (_namens_klant AND length(btrim(_notitie))<10) THEN RAISE EXCEPTION 'Teamnotitie is verplicht (10 tot 1000 tekens)'; END IF;
 IF EXISTS(SELECT 1 FROM public.cyber_toevoeg_verzoeken r WHERE r.policy_id=p.id AND r.status IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie')) THEN RAISE EXCEPTION 'Er staat al een cyberverzoek in beoordeling'; END IF;
 INSERT INTO public.cyber_toevoeg_verzoeken(policy_id,onderneming_id,lead_id,user_id,aangevraagd_door,bron,antwoorden,gewenste_ingangsdatum,akkoord_tekst,notitie,is_test)
 VALUES(p.id,p.onderneming_id,p.lead_id,p.user_id,auth.uid(),CASE WHEN _namens_klant THEN 'team' ELSE 'klant' END,_antwoorden,_ingang,'Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.',btrim(_notitie),p.is_test) RETURNING id INTO v_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_aangevraagd','Cyberverzoek ontvangen voor handmatige beoordeling: '||v_id,auth.uid(),p.lead_id,p.is_test);
 RETURN v_id;
END $$;