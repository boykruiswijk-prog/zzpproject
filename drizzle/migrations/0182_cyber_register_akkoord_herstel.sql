CREATE OR REPLACE FUNCTION public.leg_cyber_aanvraag_vast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=NEW.extra_data->'cyber'; v_tekst text:='Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.';
BEGIN
 IF c->>'versie'='2026-10-08' AND c->>'gekozen'='true' THEN
  IF c->>'akkoord' IS DISTINCT FROM 'true' OR NOT (c->'antwoorden' @> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb) OR NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL THEN RAISE EXCEPTION 'Cyber-akkoord, geldige antwoorden en datums verplicht'; END IF;
  INSERT INTO public.cyber_akkoord_bewijs(lead_id,versie,akkoord_tekst,client_akkoord_op,antwoorden,is_test) VALUES(NEW.id,c->>'versie',v_tekst,(c->>'client_akkoord_op')::timestamptz,c->'antwoorden',NEW.is_test);
 END IF;
 IF c->>'versie'='2026-10-08' AND c->>'afgewezen'='true' THEN
  INSERT INTO public.crm_taken(soort,omschrijving,details,team,is_test) VALUES('nieuwe_aanvraag_nodig','Ellen: cyber niet passend op acceptatievragen, bespreek een passende oplossing.',jsonb_build_object('lead_id',NEW.id,'cyber_antwoorden',c->'antwoorden'),'verzekering',NEW.is_test);
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test) VALUES('cyber_opvolging','Ellen: passende oplossing bespreken na cyberacceptatie',NEW.id,NEW.is_test);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.leg_cyber_aanvraag_vast() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen(_policy_id uuid, _antwoorden jsonb, _ingang date, _akkoord boolean, _notitie text DEFAULT ''::text, _namens_klant boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE p public.policies%ROWTYPE; v_id uuid; team boolean:=public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering');
 morgen date:=(now() AT TIME ZONE 'Europe/Amsterdam')::date+1; v_terug date; BEGIN
 IF auth.uid() IS NULL OR _namens_klant IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 SELECT * INTO p FROM public.policies WHERE id=_policy_id FOR UPDATE;
 IF p.id IS NULL OR (NOT _namens_klant AND (p.user_id IS NULL OR p.user_id IS DISTINCT FROM auth.uid())) OR (_namens_klant AND NOT team) THEN RAISE EXCEPTION 'geen toegang of klantaccount ontbreekt'; END IF;
 IF NOT public.cyber_toevoegen_mogelijk(p.id) THEN RAISE EXCEPTION 'Alleen bij een actieve BAV + AVB zonder cyber'; END IF;
 IF _akkoord IS DISTINCT FROM true THEN RAISE EXCEPTION 'Akkoord is verplicht'; END IF;
 IF _ingang IS NULL THEN RAISE EXCEPTION 'De ingangsdatum is vroegst morgen'; END IF;
 IF _ingang < morgen THEN
   v_terug:=CASE WHEN _namens_klant THEN public.cyber_terugwerkend_vroegst(p.id) END;
   IF v_terug IS NULL THEN RAISE EXCEPTION 'De ingangsdatum is vroegst morgen'; END IF;
   IF _ingang < v_terug THEN RAISE EXCEPTION 'De ingangsdatum is vroegst de ingangsdatum van de BAV + AVB (%)', to_char(v_terug,'DD-MM-YYYY'); END IF;
 END IF;
 IF _antwoorden IS NULL OR jsonb_typeof(_antwoorden) <> 'object' OR _antwoorden <> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb THEN RAISE EXCEPTION 'Beantwoord alle cybervragen en voldoe aan de voorwaarden'; END IF;
 IF _notitie IS NULL OR length(_notitie)>1000 OR (_namens_klant AND length(btrim(_notitie))<10) THEN RAISE EXCEPTION 'Teamnotitie is verplicht (10 tot 1000 tekens)'; END IF;
 IF EXISTS(SELECT 1 FROM public.cyber_toevoeg_verzoeken r WHERE r.policy_id=p.id AND r.status IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie')) THEN RAISE EXCEPTION 'Er staat al een cyberverzoek in beoordeling'; END IF;
 INSERT INTO public.cyber_toevoeg_verzoeken(policy_id,onderneming_id,lead_id,user_id,aangevraagd_door,bron,antwoorden,gewenste_ingangsdatum,akkoord_tekst,notitie,is_test)
 VALUES(p.id,p.onderneming_id,p.lead_id,p.user_id,auth.uid(),CASE WHEN _namens_klant THEN 'team' ELSE 'klant' END,_antwoorden,_ingang,'Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.',btrim(_notitie),p.is_test) RETURNING id INTO v_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_aangevraagd','Cyberverzoek ontvangen voor handmatige beoordeling: '||v_id,auth.uid(),p.lead_id,p.is_test);
 IF _ingang < morgen THEN
   INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,is_test)
   VALUES('cyber_ingang_terugwerkend','Cyberingangsdatum '||to_char(_ingang,'DD-MM-YYYY')||' (eerder dan morgen) gekozen voor verzoek '||v_id||'. Reden: '||btrim(_notitie),auth.uid(),(SELECT u.email FROM auth.users u WHERE u.id=auth.uid()),p.lead_id,p.is_test);
 END IF;
 RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_aanvragen(uuid,jsonb,date,boolean,text,boolean) TO authenticated;