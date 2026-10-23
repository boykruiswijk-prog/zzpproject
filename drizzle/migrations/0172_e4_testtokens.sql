CREATE TABLE public.e4_testtokens (token uuid PRIMARY KEY DEFAULT gen_random_uuid(), verloopt_op timestamptz NOT NULL DEFAULT now() + interval '60 minutes', gebruikt_op timestamptz);
GRANT ALL ON public.e4_testtokens TO service_role;
REVOKE ALL ON public.e4_testtokens FROM PUBLIC, anon, authenticated;
ALTER TABLE public.e4_testtokens ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.e4_testtokens IS 'Tijdelijke E4-testtoegang; alleen gemarkeerde testketens, droog. Na gebruik verlopen zetten, nooit leegmaken.';
CREATE OR REPLACE FUNCTION public.e4_token_beoordeel(_token uuid, _id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.e4_testtokens WHERE token=_token AND verloopt_op>now()) THEN RAISE EXCEPTION 'E4-testtoken ongeldig of verlopen' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id FOR UPDATE;
 IF r.id IS NULL OR NOT r.is_test OR NOT EXISTS(SELECT 1 FROM public.leads l JOIN public.policies p ON p.id=r.policy_id JOIN public.ondernemingen o ON o.id=r.onderneming_id WHERE l.id=r.lead_id AND p.lead_id=l.id AND p.onderneming_id=o.id AND l.is_test AND p.is_test AND o.is_test AND lower(l.email) LIKE '%@zpzaken.nl') THEN RAISE EXCEPTION 'Token alleen voor volledig gemarkeerde testketen' USING ERRCODE='42501'; END IF;
 UPDATE public.e4_testtokens SET gebruikt_op=coalesce(gebruikt_op,now()) WHERE token=_token;
 IF r.status='wacht_op_beoordeling' THEN
  UPDATE public.cyber_toevoeg_verzoeken SET status='akkoord_wacht_op_activatie',beoordeling_notitie='E4-testtoken: gemarkeerde test, droog',beoordeeld_door='00000000-0000-4000-8000-0000000e4e4e',beoordeeld_op=now() WHERE id=r.id;
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test) VALUES('cyber_toevoegen_beoordeeld','Cyberverzoek '||r.id||': akkoord via E4-testtoken (droog).',r.lead_id,true);
 END IF;
 RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.e4_token_beoordeel(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e4_token_beoordeel(uuid,uuid) TO service_role;