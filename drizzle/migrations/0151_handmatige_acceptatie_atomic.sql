CREATE OR REPLACE FUNCTION public.leg_handmatige_acceptatie_vast(_lead_id uuid, _user_id uuid, _geen_sepa boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads%ROWTYPE; e jsonb; _naam text;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Alleen beveiligde serveractie' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','supervisor','verzekering')) THEN RAISE EXCEPTION 'Geen acceptatierechten' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aanvraag niet gevonden'; END IF;
 IF l.status='afgewezen' THEN RAISE EXCEPTION 'Afgewezen aanvraag'; END IF;
 IF NOT coalesce(l.vereist_handmatige_beoordeling,false) AND NOT (coalesce(l.extra_data,'{}'::jsonb) ? 'handmatige_acceptatie') THEN RAISE EXCEPTION 'Geen handmatige aanvraag'; END IF;
 e := coalesce(l.extra_data,'{}'::jsonb);
 IF coalesce(e #>> '{handmatige_acceptatie,bevestigd_op}','') <> '' THEN RETURN e; END IF;
 e := jsonb_set(e,'{handmatige_acceptatie}',coalesce(e->'handmatige_acceptatie','{}'::jsonb) || jsonb_build_object('bevestigd_op',now(),'bevestigd_door',_user_id,'geen_sepa_nodig',coalesce(_geen_sepa,false)));
 UPDATE public.leads SET extra_data=e,status='offerte_verstuurd' WHERE id=_lead_id;
 SELECT full_name INTO _naam FROM public.profiles WHERE id=_user_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,uitgevoerd_door,uitgevoerd_door_naam,klant_email,is_test)
 VALUES ('handmatige_acceptatie_bevestigd','Handmatige aanvraag geaccepteerd. Geen SEPA-machtiging nodig: ' || CASE WHEN coalesce(_geen_sepa,false) THEN 'ja.' ELSE 'nee.' END,_lead_id,_user_id,_naam,l.email,l.is_test);
 RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.leg_handmatige_acceptatie_vast(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.leg_handmatige_acceptatie_vast(uuid,uuid,boolean) TO service_role;