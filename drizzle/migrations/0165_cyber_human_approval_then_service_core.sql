CREATE OR REPLACE FUNCTION public.cyber_toevoegen_beoordelen(_id uuid,_akkoord boolean,_notitie text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'Teamtoegang met tweestapsverificatie vereist' USING ERRCODE='42501'; END IF;
 IF _akkoord IS NULL OR _notitie IS NULL OR length(btrim(_notitie))<10 OR length(_notitie)>1000 THEN RAISE EXCEPTION 'Toelichting vereist (10 tot 1000 tekens)'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Verzoek niet gevonden'; END IF;
 IF r.geactiveerd_op IS NOT NULL THEN IF NOT _akkoord THEN RAISE EXCEPTION 'Actief verzoek kan niet worden afgewezen'; END IF; RETURN 'actief'; END IF;
 IF r.status='afgewezen' THEN IF _akkoord THEN RAISE EXCEPTION 'Verzoek is afgewezen'; END IF; RETURN 'afgewezen'; END IF;
 IF r.status NOT IN ('wacht_op_beoordeling','akkoord_wacht_op_activatie') THEN RAISE EXCEPTION 'Verzoek is niet in beoordeling'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET status=CASE WHEN _akkoord THEN 'akkoord_wacht_op_activatie' ELSE 'afgewezen' END,beoordeling_notitie=btrim(_notitie),beoordeeld_door=auth.uid(),beoordeeld_op=now() WHERE id=r.id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_toevoegen_beoordeeld','Cyberverzoek '||r.id||': '||CASE WHEN _akkoord THEN 'akkoord' ELSE 'afgewezen' END||'. '||btrim(_notitie),auth.uid(),r.lead_id,r.is_test);
 RETURN CASE WHEN _akkoord THEN 'akkoord_wacht_op_activatie' ELSE 'afgewezen' END;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_beoordelen(uuid,boolean,text) TO authenticated,service_role;