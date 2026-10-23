ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS document_claim uuid, ADD COLUMN IF NOT EXISTS document_claim_op timestamptz;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_document_claim(_id uuid,_lease uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET document_claim=_lease,document_claim_op=now() WHERE id=_id AND geactiveerd_op IS NOT NULL AND certificaat_pad IS NULL AND (document_claim IS NULL OR document_claim_op<now()-interval '10 minutes'); RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_document_klaar(_id uuid,_lease uuid,_pad text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; p public.policies%ROWTYPE; BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.certificaat_pad IS NOT NULL THEN RETURN true; END IF;
 IF r.document_claim IS DISTINCT FROM _lease OR r.geactiveerd_op IS NULL OR _pad IS DISTINCT FROM 'cyber-toevoegen/'||r.id::text||'.pdf' THEN RAISE EXCEPTION 'ongeldige documentclaim'; END IF;
 SELECT * INTO p FROM public.policies WHERE id=r.policy_id FOR UPDATE;
 INSERT INTO public.policy_versies(policy_id,certificate_number,versie,actie,oude_waarden,nieuwe_waarden,oude_pdf_pad,reden,uitgevoerd_door) VALUES(p.id,p.certificate_number,p.versie,'aangepast',jsonb_build_object('pdf_url',p.pdf_url,'versie',p.versie),jsonb_build_object('pdf_url',_pad,'versie',p.versie+1),'cyber-toevoegen/'||r.id::text||'-vorige.pdf','Cyber toegevoegd, BAV-gegevens ongewijzigd',r.beoordeeld_door);
 UPDATE public.policies SET pdf_url=_pad,versie=p.versie+1 WHERE id=p.id;
 UPDATE public.cyber_toevoeg_verzoeken SET certificaat_pad=_pad,certificaat_versie=p.versie+1 WHERE id=r.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_document_claim(uuid,uuid),public.cyber_toevoegen_document_klaar(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_document_claim(uuid,uuid),public.cyber_toevoegen_document_klaar(uuid,uuid,text) TO service_role;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='guard_cyber_contract';
 IF position('cyber_toevoeg_verzoek_id' IN d)=0 THEN
 d:=replace(d,'BEGIN',E'BEGIN\n IF NEW.cyber_toevoeg_verzoek_id IS NOT NULL THEN\n  IF NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL OR NEW.cyber_einddatum<NEW.cyber_ingangsdatum THEN RAISE EXCEPTION ''Cyberdatums ongeldig''; END IF;\n  IF NEW.status=''vervangen'' THEN RAISE EXCEPTION ''Cyber is niet pauzeerbaar''; END IF;\n  RETURN NEW;\n END IF;'); EXECUTE d; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.mijn_cyber_polissen() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x.rij) FROM (
 SELECT jsonb_build_object('lead_id',l.id,'versie',l.cyber_voorwaarden_versie,'ingang',l.cyber_ingangsdatum,'eind',greatest(l.cyber_einddatum,public.cyber_term_eind(l.cyber_ingangsdatum,(now() AT TIME ZONE 'Europe/Amsterdam')::date)),'pakket',l.gekozen_pakket) rij FROM public.leads l WHERE l.cyber_voorwaarden_versie='2026-10-08' AND EXISTS(SELECT 1 FROM public.policies p WHERE p.lead_id=l.id AND p.user_id=auth.uid())
 UNION ALL SELECT jsonb_build_object('id',r.id,'policy_id',r.policy_id,'lead_id',r.lead_id,'versie',r.voorwaarden_versie,'ingang',r.gewenste_ingangsdatum,'eind',public.cyber_term_eind(r.gewenste_ingangsdatum,(now() AT TIME ZONE 'Europe/Amsterdam')::date),'pakket',CASE WHEN k.cyclus='jaar' THEN 'jaarlijks-cyber' ELSE 'maandelijks-cyber' END,'later_toegevoegd',true) FROM public.cyber_toevoeg_verzoeken r JOIN public.klant_contracten k ON k.id=r.contract_id JOIN public.policies p ON p.id=r.policy_id WHERE r.geactiveerd_op IS NOT NULL AND p.user_id=auth.uid()
 ) x),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.mijn_cyber_polissen() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mijn_cyber_polissen() TO authenticated,service_role;