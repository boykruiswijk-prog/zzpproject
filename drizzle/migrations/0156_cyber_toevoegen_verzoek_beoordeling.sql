CREATE TABLE public.cyber_toevoeg_verzoeken (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), policy_id uuid NOT NULL REFERENCES public.policies(id), onderneming_id uuid REFERENCES public.ondernemingen(id), lead_id uuid REFERENCES public.leads(id), user_id uuid NOT NULL, aangevraagd_door uuid NOT NULL, bron text NOT NULL CHECK (bron IN ('klant','team')), antwoorden jsonb NOT NULL, voorwaarden_versie text NOT NULL DEFAULT '2026-10-08' CHECK (voorwaarden_versie='2026-10-08'), gewenste_ingangsdatum date NOT NULL, akkoord_tekst text NOT NULL, akkoord_op timestamptz NOT NULL DEFAULT now(), notitie text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'wacht_op_beoordeling' CHECK(status IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie','afgewezen')), beoordeling_notitie text, beoordeeld_door uuid, beoordeeld_op timestamptz, created_at timestamptz NOT NULL DEFAULT now(), is_test boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.cyber_toevoeg_verzoeken TO authenticated;
GRANT ALL ON public.cyber_toevoeg_verzoeken TO service_role;
ALTER TABLE public.cyber_toevoeg_verzoeken ENABLE ROW LEVEL SECURITY;
CREATE POLICY cyber_verzoek_eigen_lezen ON public.cyber_toevoeg_verzoeken FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'));
CREATE UNIQUE INDEX cyber_verzoek_een_open_per_polis ON public.cyber_toevoeg_verzoeken(policy_id) WHERE status IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie');
CREATE FUNCTION public.cyber_toevoegen_mogelijk(_policy_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.policies p LEFT JOIN public.leads l ON l.id=p.lead_id
 WHERE p.id=_policy_id AND p.status='geldig' AND p.start_date <= (now() AT TIME ZONE 'Europe/Amsterdam')::date
 AND (l.id IS NULL OR l.status IN ('actief','klant'))
 AND (EXISTS(SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id=p.onderneming_id AND k.product='bav_avb' AND k.status='actief' AND k.begin_datum <= (now() AT TIME ZONE 'Europe/Amsterdam')::date AND public.contract_opzegging(k.id) IS NULL)
 OR (l.status IN ('actief','klant') AND l.gekozen_pakket IN ('maandelijks','jaarlijks')))
 AND p.package_type NOT ILIKE '%cyber%' AND p.package_type NOT ILIKE '%combi%'
 AND NOT EXISTS(SELECT 1 FROM public.leads cl WHERE (cl.id=p.lead_id OR (p.onderneming_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.policies cp WHERE cp.lead_id=cl.id AND cp.onderneming_id=p.onderneming_id))) AND (cl.gekozen_pakket ~ '[-_]cyber$' OR cl.cyber_voorwaarden_versie='2026-10-08'))
 AND NOT EXISTS(SELECT 1 FROM public.klant_contracten ck WHERE ck.product='cyber_clear' AND ck.status IN ('actief','loopt_af') AND (ck.onderneming_id=p.onderneming_id OR ck.cyber_lead_id=p.lead_id)));
$$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_mogelijk(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_mogelijk(uuid) TO service_role;
CREATE FUNCTION public.cyber_toevoegen_opties(_onderneming_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE team boolean:=public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'); BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF _onderneming_id IS NOT NULL AND NOT team THEN RAISE EXCEPTION 'geen toegang'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('policy_id',p.id,'label',p.certificate_number,'cyclus',coalesce((SELECT k.cyclus FROM public.klant_contracten k WHERE k.onderneming_id=p.onderneming_id AND k.product='bav_avb' AND k.status='actief' ORDER BY k.created_at DESC LIMIT 1),CASE WHEN l.gekozen_pakket='jaarlijks' THEN 'jaar' ELSE 'maand' END))) FROM public.policies p LEFT JOIN public.leads l ON l.id=p.lead_id WHERE ((_onderneming_id IS NULL AND p.user_id=auth.uid()) OR (team AND p.onderneming_id=_onderneming_id)) AND public.cyber_toevoegen_mogelijk(p.id)),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_opties(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_opties(uuid) TO authenticated,service_role;
CREATE FUNCTION public.cyber_toevoegen_aanvragen(_policy_id uuid,_antwoorden jsonb,_ingang date,_akkoord boolean,_notitie text DEFAULT '',_namens_klant boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.policies%ROWTYPE; v_id uuid; team boolean:=public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'); v_user uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 SELECT * INTO p FROM public.policies WHERE id=_policy_id FOR UPDATE;
 IF p.id IS NULL OR (NOT _namens_klant AND p.user_id IS DISTINCT FROM auth.uid()) OR (_namens_klant AND NOT team) THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF NOT public.cyber_toevoegen_mogelijk(p.id) THEN RAISE EXCEPTION 'Alleen bij een actieve BAV + AVB zonder cyber'; END IF;
 IF _akkoord IS DISTINCT FROM true THEN RAISE EXCEPTION 'Akkoord is verplicht'; END IF;
 IF _ingang IS NULL OR _ingang < (now() AT TIME ZONE 'Europe/Amsterdam')::date+1 THEN RAISE EXCEPTION 'De ingangsdatum is vroegst morgen'; END IF;
 IF _antwoorden IS NULL OR jsonb_typeof(_antwoorden) <> 'object' OR _antwoorden <> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb THEN RAISE EXCEPTION 'Beantwoord alle cybervragen en voldoe aan de voorwaarden'; END IF;
 IF _notitie IS NULL OR length(_notitie)>1000 OR (_namens_klant AND length(btrim(_notitie))<10) THEN RAISE EXCEPTION 'Teamnotitie is verplicht (10 tot 1000 tekens)'; END IF;
 IF EXISTS(SELECT 1 FROM public.cyber_toevoeg_verzoeken r WHERE r.policy_id=p.id AND r.status IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie')) THEN RAISE EXCEPTION 'Er staat al een cyberverzoek in beoordeling'; END IF;
 v_user:=coalesce(p.user_id,auth.uid());
 INSERT INTO public.cyber_toevoeg_verzoeken(policy_id,onderneming_id,lead_id,user_id,aangevraagd_door,bron,antwoorden,gewenste_ingangsdatum,akkoord_tekst,notitie,is_test)
 VALUES(p.id,p.onderneming_id,p.lead_id,v_user,auth.uid(),CASE WHEN _namens_klant THEN 'team' ELSE 'klant' END,_antwoorden,_ingang,'Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.',btrim(_notitie),p.is_test) RETURNING id INTO v_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_aangevraagd','Cyberverzoek ontvangen voor handmatige beoordeling: '||v_id,auth.uid(),p.lead_id,p.is_test);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) TO authenticated,service_role;
CREATE FUNCTION public.cyber_toevoegen_beoordelen(_id uuid,_akkoord boolean,_notitie text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; v_status text; BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'Teamtoegang met tweestapsverificatie vereist'; END IF;
 IF _akkoord IS NULL OR _notitie IS NULL OR length(btrim(_notitie))<10 OR length(_notitie)>1000 THEN RAISE EXCEPTION 'Toelichting vereist (10 tot 1000 tekens)'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.id IS NULL OR r.status <> 'wacht_op_beoordeling' THEN RAISE EXCEPTION 'Verzoek is niet in beoordeling'; END IF;
 IF _akkoord AND NOT public.cyber_toevoegen_mogelijk(r.policy_id) THEN RAISE EXCEPTION 'Polis is niet meer geschikt voor cyber toevoegen'; END IF;
 v_status:=CASE WHEN _akkoord THEN 'akkoord_wacht_op_activatie' ELSE 'afgewezen' END;
 UPDATE public.cyber_toevoeg_verzoeken SET status=v_status,beoordeling_notitie=btrim(_notitie),beoordeeld_door=auth.uid(),beoordeeld_op=now() WHERE id=r.id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_beoordeeld','Cyberverzoek '||r.id||': '||v_status||'. '||btrim(_notitie),auth.uid(),r.lead_id,r.is_test);
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) TO authenticated,service_role;
COMMENT ON TABLE public.cyber_toevoeg_verzoeken IS 'E-aanvulling 3: alleen verzoek en handmatige beoordeling. Akkoord activeert of factureert niets; aparte cyber-only activatieroute ontbreekt.';