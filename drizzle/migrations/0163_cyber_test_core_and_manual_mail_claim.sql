ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS mail_poging integer NOT NULL DEFAULT 0;
DO $outer$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_beoordelen';
 d:=replace(d,'public.cyber_toevoegen_beoordelen(_id uuid, _akkoord boolean, _notitie text)','public.cyber_toevoegen_activeren_intern(_id uuid, _notitie text, _test boolean DEFAULT false)');
 d:=replace(d,'BEGIN', E'BEGIN\n IF auth.role() IS DISTINCT FROM ''service_role'' THEN RAISE EXCEPTION ''geen toegang'' USING ERRCODE=''42501''; END IF;');
 d:=replace(d,'IF auth.uid() IS NULL OR coalesce(auth.jwt()->>''aal'','''') <> ''aal2'' OR NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),''verzekering'')) THEN RAISE EXCEPTION ''Teamtoegang met tweestapsverificatie vereist'' USING ERRCODE=''42501''; END IF;', '');
 d:=replace(d,'_akkoord','true');
 d:=replace(d, 'IF r.id IS NULL THEN RAISE EXCEPTION ''Verzoek niet gevonden''; END IF;', E'IF r.id IS NULL THEN RAISE EXCEPTION ''Verzoek niet gevonden''; END IF;\n IF _test THEN\n  IF NOT r.is_test OR NOT EXISTS(SELECT 1 FROM public.leads l JOIN public.policies p ON p.id=r.policy_id JOIN public.ondernemingen o ON o.id=r.onderneming_id WHERE l.id=r.lead_id AND l.is_test AND p.is_test AND o.is_test AND lower(l.email) LIKE ''%@zpzaken.nl'') THEN RAISE EXCEPTION ''testmarkering vereist''; END IF;\n ELSIF r.is_test OR r.status<>''akkoord_wacht_op_activatie'' OR r.beoordeeld_door IS NULL THEN RAISE EXCEPTION ''menselijke beoordeling vereist''; END IF;');
 d:=replace(d,'IF true AND NOT coalesce((SELECT actief FROM public.cyber_activatie_config WHERE id),false)', 'IF true AND NOT _test AND NOT coalesce((SELECT actief FROM public.cyber_activatie_config WHERE id),false)');
 IF position('public.cyber_toevoegen_activeren_intern' IN d)=0 THEN RAISE EXCEPTION 'activation core extraction failed'; END IF;
 EXECUTE d;
END $outer$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_activeren_intern(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_activeren_intern(uuid,text,boolean) TO service_role;
DO $outer$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='facturatie_kandidaten';
 d:=replace(d,'public.facturatie_kandidaten(_van date, _tot date)','public.facturatie_testcontract(_id uuid, _van date, _tot date)');
 d:=replace(d,'IF NOT (auth.role() = ''service_role'' OR public.is_supervisor_or_admin(auth.uid())) THEN', 'IF auth.role() IS DISTINCT FROM ''service_role'' THEN');
 d:=replace(d,'AND NOT k.is_test AND NOT o.is_test', 'AND k.id=_id AND k.is_test AND o.is_test AND k.cyber_toevoeg_verzoek_id IS NOT NULL');
 IF position('public.facturatie_testcontract' IN d)=0 OR position('k.id=_id AND k.is_test AND o.is_test' IN d)=0 THEN RAISE EXCEPTION 'test planner extraction failed'; END IF;
 EXECUTE d;
END $outer$;
REVOKE ALL ON FUNCTION public.facturatie_testcontract(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.facturatie_testcontract(uuid,date,date) TO service_role;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_mail_claim(_id uuid,_retry boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET mail_status='geclaimd',mail_claim_op=now(),mail_poging=mail_poging+1
 WHERE id=_id AND geactiveerd_op IS NOT NULL AND NOT is_test AND certificaat_pad IS NOT NULL
 AND ((NOT _retry AND mail_status='wacht') OR (_retry AND mail_status IN ('mail_mislukt','mislukt','niet_verzonden_schakelaar_uit','niet_verzonden_geen_ontvanger','niet_verzonden_tekstfout','niet_verzonden_gate')))
 RETURNING mail_poging INTO n;
 IF n IS NOT NULL THEN
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test)
 SELECT CASE WHEN _retry THEN 'cyber_mail_handmatig_opnieuw' ELSE 'cyber_mail_eerste_poging' END,'Cyberbevestiging verzoek '||id||', poging '||n,lead_id,false FROM public.cyber_toevoeg_verzoeken WHERE id=_id;
 END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_mail_claim(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_mail_claim(uuid,boolean) TO service_role;
COMMENT ON FUNCTION public.facturatie_testcontract(uuid,date,date) IS 'Read-only single marked cyber test contract, same candidate SQL as production; never for Exact writes.';
COMMENT ON FUNCTION public.cyber_toevoegen_activeren_intern(uuid,text,boolean) IS 'Service-only core; test bypass requires marked policy/lead/company. Real activation requires prior human approval and release gate.';