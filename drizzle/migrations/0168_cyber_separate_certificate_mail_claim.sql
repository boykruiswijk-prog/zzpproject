ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS certificaat_mail_status text NOT NULL DEFAULT 'wacht', ADD COLUMN IF NOT EXISTS certificaat_mail_poging integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_certificaat_mail_claim(_id uuid,_retry boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 UPDATE public.cyber_toevoeg_verzoeken SET certificaat_mail_status='geclaimd',certificaat_mail_poging=certificaat_mail_poging+1
 WHERE id=_id AND geactiveerd_op IS NOT NULL AND NOT is_test AND certificaat_pad IS NOT NULL
 AND ((NOT _retry AND certificaat_mail_status='wacht') OR (_retry AND certificaat_mail_status='mail_mislukt'))
 RETURNING certificaat_mail_poging INTO n;
 IF n IS NOT NULL THEN
 INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test)
 SELECT CASE WHEN _retry THEN 'cyber_certificaat_handmatig_opnieuw' ELSE 'cyber_certificaat_eerste_poging' END,'Cybercertificaat verzoek '||id||', poging '||n,lead_id,false FROM public.cyber_toevoeg_verzoeken WHERE id=_id;
 END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_certificaat_mail_claim(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_certificaat_mail_claim(uuid,boolean) TO service_role;
DO $outer$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_mail_claim' AND pronargs=2;
 d:=replace(d,'AND certificaat_pad IS NOT NULL','AND certificaat_pad IS NOT NULL AND certificaat_mail_status=''verzonden''');
 EXECUTE d;
END $outer$;