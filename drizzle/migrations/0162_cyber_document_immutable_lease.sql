DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_document_klaar';
 d:=replace(d,' IF r.certificaat_pad IS NOT NULL THEN RETURN true; END IF;', ' IF r.certificaat_pad IS NOT NULL THEN RETURN r.document_claim IS NOT DISTINCT FROM _lease AND r.certificaat_pad IS NOT DISTINCT FROM _pad; END IF;');
 d:=replace(d,'''cyber-toevoegen/''||r.id::text||''.pdf''','''cyber-toevoegen/''||r.id::text||''-''||_lease::text||''.pdf''');
 d:=replace(d,'''cyber-toevoegen/''||r.id::text||''-vorige.pdf''','''cyber-toevoegen/''||r.id::text||''-''||_lease::text||''-vorige.pdf''');
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.cyber_toevoegen_document_snapshot(_id uuid,_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cyber_toevoeg_verzoeken%ROWTYPE; p public.policies%ROWTYPE; BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.cyber_toevoeg_verzoeken WHERE id=_id;
 IF r.document_claim IS DISTINCT FROM _lease THEN RAISE EXCEPTION 'ongeldige claim'; END IF;
 SELECT * INTO p FROM public.policies WHERE id=r.policy_id;
 RETURN jsonb_build_object('versie',p.versie,'pdf_url',p.pdf_url);
END $$;
REVOKE ALL ON FUNCTION public.cyber_toevoegen_document_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_toevoegen_document_snapshot(uuid,uuid) TO service_role;
ALTER TABLE public.cyber_toevoeg_verzoeken ADD COLUMN IF NOT EXISTS document_basis_versie integer;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_document_claim';
 d:=replace(d,'SET document_claim=_lease,document_claim_op=now()','SET document_claim=_lease,document_claim_op=now(),document_basis_versie=(SELECT p.versie FROM public.policies p WHERE p.id=policy_id)'); EXECUTE d;
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_document_klaar';
 d:=replace(d,' SELECT * INTO p FROM public.policies WHERE id=r.policy_id FOR UPDATE;',E' SELECT * INTO p FROM public.policies WHERE id=r.policy_id FOR UPDATE;\n IF p.versie IS DISTINCT FROM r.document_basis_versie THEN RAISE EXCEPTION ''Certificaat is ondertussen gewijzigd, probeer later opnieuw''; END IF;'); EXECUTE d;
END $$;