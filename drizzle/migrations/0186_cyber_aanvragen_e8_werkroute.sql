ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS certificaat_gecontroleerd_pad text, ADD COLUMN IF NOT EXISTS certificaat_gecontroleerd_op timestamptz, ADD COLUMN IF NOT EXISTS certificaat_gecontroleerd_door uuid;
CREATE OR REPLACE FUNCTION public.cyber_aanvraag_open(_status text,_mail text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT coalesce(_status,'') <> 'afgewezen' AND coalesce(_mail,'') <> 'verzonden' $$;
REVOKE ALL ON FUNCTION public.cyber_aanvraag_open(text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.cyber_aanvraag_open(text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.cyber_aanvragen_werkvoorraad(_toon_test boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 IF _toon_test AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_supervisor_or_admin(auth.uid()) THEN _toon_test:=false; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'onderneming_id',r.onderneming_id,'policy_id',r.policy_id,'klant',coalesce(o.naam,p.certificate_holder),'bav_nummer',p.certificate_number,'gewenste_ingangsdatum',r.gewenste_ingangsdatum,'betaalwijze',coalesce(k.cyclus,b.cyclus),'notitie',r.notitie,'status',r.status,'beoordeling_notitie',r.beoordeling_notitie,'geactiveerd_op',r.geactiveerd_op,'certificaat_pad',r.certificaat_pad,'certificaat_gecontroleerd_pad',r.certificaat_gecontroleerd_pad,'certificaat_gecontroleerd_op',r.certificaat_gecontroleerd_op,'certificaat_mail_status',r.certificaat_mail_status,'mail_status',r.mail_status,'created_at',r.created_at,'is_test',r.is_test,'antwoorden',r.antwoorden,'open',public.cyber_aanvraag_open(r.status,r.mail_status)) ORDER BY r.created_at DESC)
 FROM public.cyber_toevoeg_verzoeken r JOIN public.policies p ON p.id=r.policy_id LEFT JOIN public.ondernemingen o ON o.id=r.onderneming_id LEFT JOIN public.klant_contracten k ON k.id=r.contract_id LEFT JOIN LATERAL(SELECT cyclus FROM public.klant_contracten WHERE onderneming_id=r.onderneming_id AND product='bav_avb' AND status IN ('actief','loopt_af') ORDER BY created_at DESC LIMIT 1)b ON true WHERE (_toon_test OR NOT r.is_test)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.cyber_aanvragen_werkvoorraad(boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.cyber_aanvragen_werkvoorraad(boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.tel_cyber_aanvragen_open(_toon_test boolean DEFAULT false) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT count(*)::integer FROM jsonb_array_elements(public.cyber_aanvragen_werkvoorraad(_toon_test)) r WHERE (r->>'open')::boolean $$;
REVOKE ALL ON FUNCTION public.tel_cyber_aanvragen_open(boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.tel_cyber_aanvragen_open(boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.cyber_certificaat_controleren(_id uuid,_pad text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) OR lower(coalesce(auth.jwt()->>'email',''))<>'ellen.baars@zpzaken.nl' THEN RAISE EXCEPTION 'Ellen met tweestapsverificatie moet het certificaat controleren' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.geactiveerd_op IS NULL OR r.certificaat_pad IS NULL OR r.certificaat_pad IS DISTINCT FROM _pad THEN RAISE EXCEPTION 'Maak en bekijk eerst het actuele cybercertificaat'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET certificaat_gecontroleerd_pad=_pad,certificaat_gecontroleerd_op=now(),certificaat_gecontroleerd_door=auth.uid() WHERE id=_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,uitgevoerd_door,lead_id,is_test) VALUES('cyber_certificaat_gecontroleerd','Cybercertificaat gecontroleerd bij verzoek '||_id,auth.uid(),r.lead_id,r.is_test); RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cyber_certificaat_controleren(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.cyber_certificaat_controleren(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.cyber_certificaat_verzendklaar(_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','')<>'aal2' OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) OR lower(coalesce(auth.jwt()->>'email',''))<>'ellen.baars@zpzaken.nl' THEN RAISE EXCEPTION 'Alleen Ellen met tweestapsverificatie mag versturen' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id;
 IF r.geactiveerd_op IS NULL OR r.certificaat_pad IS NULL OR r.certificaat_gecontroleerd_pad IS DISTINCT FROM r.certificaat_pad OR r.certificaat_gecontroleerd_op IS NULL THEN RAISE EXCEPTION 'Controleer eerst het actuele cybercertificaat'; END IF; RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cyber_certificaat_verzendklaar(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.cyber_certificaat_verzendklaar(uuid) TO authenticated;
DO $wire$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.menu_tellers()'::regprocedure) INTO d;
 IF position('tel_cyber_aanvragen_open' in d)=0 THEN d:=replace(d,'''aanvragen'', (SELECT count(*)','''aanvragen'', public.tel_cyber_aanvragen_open(false) + (SELECT count(*)'); EXECUTE d; END IF;
 SELECT pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure) INTO d;
 IF position('cyber_aanvragen_werkvoorraad' in d)=0 THEN
 d:=replace(d,'  RETURN r || jsonb_build_object(', '  SELECT jsonb_build_object(''aantal'', public.tel_cyber_aanvragen_open(_toon_test), ''items'', coalesce(jsonb_agg(jsonb_build_object(''id'',x->>''id'',''naam'',x->>''klant'',''bedrijfsnaam'',x->>''klant'',''sinds'',x->>''created_at'',''reden'',''Cyber toevoegen'')),''[]''::jsonb)) INTO c FROM jsonb_array_elements(public.cyber_aanvragen_werkvoorraad(_toon_test)) x WHERE (x->>''open'')::boolean;
  r := r || jsonb_build_object(''cyber_toevoegen'',c);
  RETURN r || jsonb_build_object(');
 d:=replace(d,'''incasso'',''royement'']','''incasso'',''royement'',''cyber_toevoegen'']');
 IF position('cyber_aanvragen_werkvoorraad' in d)=0 THEN RAISE EXCEPTION 'Werkvoorraad niet aangepast'; END IF; EXECUTE d; END IF;
END $wire$;
COMMENT ON FUNCTION public.tel_cyber_aanvragen_open(boolean) IS 'E8: alleen open aanvraagwerk, nooit doel200, conversie of nieuwe klantinstroom';