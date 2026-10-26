CREATE OR REPLACE FUNCTION public.cyber_aanvraag_document_klaar(_id uuid,_lease uuid,_pad text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.certificaat_pad IS NOT NULL THEN RETURN r.document_claim IS NOT DISTINCT FROM _lease AND r.certificaat_pad IS NOT DISTINCT FROM _pad; END IF;
 IF r.document_claim IS DISTINCT FROM _lease OR r.geactiveerd_op IS NULL OR _pad IS DISTINCT FROM 'cyber-toevoegen/'||r.id::text||'-'||_lease::text||'.pdf' THEN RAISE EXCEPTION 'Ongeldige documentclaim'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET certificaat_pad=_pad,certificaat_versie=coalesce(certificaat_versie,0)+1,certificaat_gecontroleerd_pad=NULL,certificaat_gecontroleerd_op=NULL,certificaat_gecontroleerd_door=NULL WHERE id=_id;
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test) VALUES('cyber_certificaat_gemaakt','Apart cybercertificaat gemaakt bij verzoek '||_id,r.lead_id,r.is_test); RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cyber_aanvraag_document_klaar(uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.cyber_aanvraag_document_klaar(uuid,uuid,text) TO service_role;