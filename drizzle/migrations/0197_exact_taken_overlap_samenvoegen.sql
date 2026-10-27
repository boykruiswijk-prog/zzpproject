CREATE OR REPLACE FUNCTION public.exact_taak_groep(_id uuid) RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH RECURSIVE g AS (SELECT t.* FROM crm_taken t WHERE t.id=_id AND t.soort='exact_aanpassen' AND t.status='open' UNION SELECT t.* FROM crm_taken t JOIN g ON t.onderneming_id IS NOT DISTINCT FROM g.onderneming_id AND t.is_test=g.is_test AND t.team IS NOT DISTINCT FROM g.team WHERE t.status='open' AND t.soort='exact_aanpassen' AND (t.onderneming_id IS NOT NULL OR t.persoon_id IS NOT DISTINCT FROM g.persoon_id) AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(t.details->'velden','[]')) f WHERE coalesce(g.details->'velden','[]') ? f AND (f NOT IN ('voornaam','achternaam') OR t.persoon_id IS NOT DISTINCT FROM g.persoon_id))) SELECT g.id FROM g $$;
REVOKE ALL ON FUNCTION public.exact_taak_groep(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.exact_taak_groep(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.exact_taken_open(_toon_test boolean DEFAULT false) RETURNS SETOF public.crm_taken LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT t.* FROM crm_taken t WHERE t.status='open' AND t.soort='exact_aanpassen' AND (_toon_test OR NOT t.is_test) AND t.id=(SELECT x.id FROM crm_taken x JOIN exact_taak_groep(t.id) g ON g.id=x.id ORDER BY x.aangemaakt_op,x.id LIMIT 1) $$;
REVOKE ALL ON FUNCTION public.exact_taken_open(boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.exact_taken_open(boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.exact_taak_bewaren(_ond uuid,_pers uuid,_velden text[],_naam text,_test boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gekozen uuid; velden text[]; waarden jsonb; titel text;
BEGIN
IF NOT public.is_team_member(auth.uid()) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'geen toegang: tweestapstoegang vereist'; END IF;
IF _ond IS NOT NULL THEN PERFORM 1 FROM ondernemingen WHERE id=_ond FOR UPDATE; ELSE PERFORM 1 FROM personen WHERE id=_pers FOR UPDATE; END IF;
SELECT t.id INTO gekozen FROM crm_taken t WHERE t.status='open' AND t.soort='exact_aanpassen' AND t.is_test=_test AND t.team IS NULL AND t.onderneming_id IS NOT DISTINCT FROM _ond AND (_ond IS NOT NULL OR t.persoon_id IS NOT DISTINCT FROM _pers) AND EXISTS(SELECT 1 FROM unnest(_velden) f WHERE coalesce(t.details->'velden','[]') ? f AND (f NOT IN ('voornaam','achternaam') OR t.persoon_id IS NOT DISTINCT FROM _pers)) ORDER BY t.aangemaakt_op,t.id LIMIT 1 FOR UPDATE;
SELECT array_agg(DISTINCT f ORDER BY f) INTO velden FROM (SELECT unnest(_velden) f UNION ALL SELECT jsonb_array_elements_text(coalesce(t.details->'velden','[]')) FROM crm_taken t JOIN exact_taak_groep(gekozen) g ON g.id=t.id) s;
SELECT jsonb_object_agg(f,CASE WHEN f='iban' THEN to_jsonb(coalesce(left(o.iban,4)||'****'||right(o.iban,4),'-')) WHEN f IN ('voornaam','achternaam') THEN to_jsonb(p)->f ELSE to_jsonb(o)->f END) INTO waarden FROM unnest(velden) f LEFT JOIN ondernemingen o ON o.id=_ond LEFT JOIN personen p ON p.id=_pers;
SELECT 'Ook in Exact aanpassen: '||array_to_string(velden,', ')||coalesce(' ('||o.naam||coalesce(', relatie '||o.exact_relatie_code,'')||')','') INTO titel FROM (SELECT 1) s LEFT JOIN ondernemingen o ON o.id=_ond;
IF gekozen IS NULL THEN
INSERT INTO crm_taken(soort,onderneming_id,persoon_id,omschrijving,details,aangemaakt_door,aangemaakt_door_naam,is_test) VALUES('exact_aanpassen',_ond,_pers,titel,jsonb_build_object('velden',velden,'laatste_waarden',waarden),auth.uid(),coalesce(_naam,'teamlid'),_test) RETURNING id INTO gekozen;
ELSE
UPDATE crm_taken SET omschrijving=titel,details=coalesce(details,'{}')||jsonb_build_object('velden',velden,'laatste_waarden',waarden,'laatst_bijgewerkt_op',now(),'samengevoegd_aantal',coalesce((details->>'samengevoegd_aantal')::int,0)+1) WHERE id=gekozen;
INSERT INTO activiteiten_log(actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,is_test) VALUES('exact_taak_bijgewerkt','Open Exact-aanpastaak '||gekozen||' bijgewerkt; velden: '||array_to_string(velden,', ')||'. Laatste waarden vastgelegd; niets naar Exact geschreven.',auth.uid(),_naam,_test);
END IF; RETURN gekozen; END $$;
REVOKE ALL ON FUNCTION public.exact_taak_bewaren(uuid,uuid,text[],text,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.exact_taak_bewaren(uuid,uuid,text[],text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.crm_taak_afronden(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.crm_taken; ids uuid[]; x uuid;
BEGIN
IF NOT public.is_team_member(auth.uid()) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'geen toegang: tweestapstoegang vereist'; END IF;
SELECT * INTO t FROM crm_taken WHERE id=_id;
IF t.onderneming_id IS NOT NULL THEN PERFORM 1 FROM ondernemingen WHERE id=t.onderneming_id FOR UPDATE; ELSIF t.persoon_id IS NOT NULL THEN PERFORM 1 FROM personen WHERE id=t.persoon_id FOR UPDATE; END IF;
SELECT * INTO t FROM crm_taken WHERE id=_id FOR UPDATE;
IF t.id IS NULL OR t.status<>'open' THEN RAISE EXCEPTION 'taak niet gevonden of al afgerond'; END IF;
IF t.soort='exact_aanpassen' THEN SELECT array_agg(g.id) INTO ids FROM exact_taak_groep(_id) g; ELSE ids:=ARRAY[_id]; END IF;
UPDATE crm_taken SET status='afgerond',afgerond_door=auth.uid(),afgerond_op=now() WHERE id=ANY(ids) AND status='open';
FOREACH x IN ARRAY ids LOOP INSERT INTO sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol) VALUES('crm_taken',x,'afgerond','status','open','afgerond',auth.uid(),get_user_role_label(auth.uid())); END LOOP;
INSERT INTO activiteiten_log(actie_type,omschrijving,uitgevoerd_door,is_test) VALUES('crm_taken_afgerond','Taak '||_id||' afgerond, inclusief overlappende taken: '||array_to_string(ids,', ')||'. Niets naar Exact geschreven.',auth.uid(),t.is_test);
RETURN true; END $$;
REVOKE ALL ON FUNCTION public.crm_taak_afronden(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.crm_taak_afronden(uuid) TO authenticated;
DO $$ DECLARE d text; nieuw text; BEGIN
 d:=pg_get_functiondef('public.crm_gegevens_wijzigen(uuid,uuid,jsonb)'::regprocedure);
 nieuw:=regexp_replace(d,'  IF array_length\(exact_velden,1\) > 0 THEN.*?  RETURN jsonb_build_object\(''gewijzigd'', n,',E'  IF array_length(exact_velden,1) > 0 THEN\n    PERFORM public.exact_taak_bewaren(o.id,p.id,exact_velden,v_naam,v_test);\n  END IF;\n  RETURN jsonb_build_object(''gewijzigd'', n,','s');
 IF nieuw=d THEN RAISE EXCEPTION 'taakblok niet gevonden'; END IF; EXECUTE nieuw;
 d:=pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
 nieuw:=replace(d,'FROM crm_taken t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id'||chr(10)||'       WHERE t.status = ''open'' AND t.soort = ''exact_aanpassen'' AND (_toon_test OR NOT t.is_test)','FROM public.exact_taken_open(_toon_test) t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id');
 IF nieuw=d THEN RAISE EXCEPTION 'dagoverzicht taakblok niet gevonden'; END IF; EXECUTE nieuw;
 d:=pg_get_functiondef('public.menu_tellers()'::regprocedure);
 nieuw:=replace(d,'SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = ''open'' AND soort = ''exact_aanpassen''','SELECT count(*) FROM public.exact_taken_open(false)');
 IF nieuw<>d THEN EXECUTE nieuw; END IF;
END $$;