DO $outer$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_activeren_intern';
 d:=replace(d,'beoordeeld_door=auth.uid(),beoordeeld_op=now()','beoordeeld_door=coalesce(auth.uid(),r.beoordeeld_door),beoordeeld_op=coalesce(r.beoordeeld_op,now())');
 EXECUTE d;
END $outer$;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_mail_claim(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 RETURN public.cyber_toevoegen_mail_claim(_id,false) IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_mail_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_mail_claim(uuid) TO service_role;