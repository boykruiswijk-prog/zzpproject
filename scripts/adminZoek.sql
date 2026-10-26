CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public.zoek_norm_compact(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT regexp_replace(lower(coalesce(v,'')), '[^a-z0-9]', '', 'g') $$;
REVOKE ALL ON FUNCTION public.zoek_norm_compact(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoek_norm_compact(text) TO authenticated,service_role;
DO $sources$
DECLARE c record; branches text[]:=ARRAY[]::text[]; fields text; titles text; mails text; phones text; nums text; ibans text; f text; expr text;
BEGIN
 FOR c IN SELECT * FROM (VALUES
 ('ondernemingen','klanten','naam,afas_contactpersoon,kvk_naam,exact_account_naam','factuur_email','','kvk,exact_relatie_code,postcode,kvk_postcode','iban','NULL::uuid','id','NULL::uuid','/admin/klanten/'),
 ('leads','leads','voornaam,achternaam,bedrijfsnaam','email','telefoon','kvk_nummer,exact_relatie_code,adres_postcode','iban','id','NULL::uuid','NULL::uuid','/admin/leads/'),
 ('aanvraag_concepten','afgehaakt','voornaam,achternaam,bedrijfsnaam','email','telefoon','kvk','','lead_id','NULL::uuid','NULL::uuid','/admin/afgehaakt?record='),
 ('bav_aanmeldingen','aanmeldingen','voornaam,achternaam,bedrijfsnaam','email','telefoon','kvk_nummer,exact_abonnement_id','iban','lead_id','NULL::uuid','NULL::uuid','/admin/zoekrecord/bav_aanmeldingen/'),
 ('personen','personen','voornaam,achternaam','genormaliseerd_email,email_weergave','telefoon','','','NULL::uuid','(SELECT po.onderneming_id FROM public.persoon_onderneming po WHERE po.persoon_id=t.id ORDER BY po.created_at LIMIT 1)','NULL::uuid','/admin/personen/'),
 ('klant_contracten','contracten','product','','','abonnement_nr','','cyber_lead_id','onderneming_id','NULL::uuid','/admin/klanten/'),
 ('policies','polissen','certificate_holder,insured_name','','','certificate_number','','lead_id','NULL::uuid','NULL::uuid','/admin/leads/'),
 ('klant_certificaten','certificaten','bron_naam,bron_contact','','','certificaatnummer','','NULL::uuid','onderneming_id','persoon_id','/admin/klanten/'),
 ('cyber_toevoeg_verzoeken','cyber','','','','','','lead_id','onderneming_id','NULL::uuid','/admin/aanvragen?cyber='),
 ('klant_service_aanvragen','service','voornaam,achternaam','email','telefoon','polisnummer','','NULL::uuid','onderneming_id','NULL::uuid','/admin/service-aanvragen/'),
 ('aov_aanmeldingen','aov','naam','email','telefoon','','','NULL::uuid','NULL::uuid','NULL::uuid','/admin/zoekrecord/aov_aanmeldingen/'),
 ('screening_aanvragen','screening','voornaam,achternaam,bedrijfsnaam','email','telefoon','kvk_nummer','iban','NULL::uuid','NULL::uuid','NULL::uuid','/admin/screening-aanvragen/'),
 ('collective_signups','collectief','naam','email','telefoon','postcode','','NULL::uuid','NULL::uuid','NULL::uuid','/admin/zoekrecord/collective_signups/'),
 ('collective_suggestions','collectief','naam','email','','','','NULL::uuid','NULL::uuid','NULL::uuid','/admin/zoekrecord/collective_suggestions/'),
 ('collective_newsletter','collectief','','email','','','','NULL::uuid','NULL::uuid','NULL::uuid','/admin/zoekrecord/collective_newsletter/'),
 ('klant_mandaten','mandaten','','','','relatiecode,kenmerk','iban','NULL::uuid','onderneming_id','NULL::uuid','/admin/klanten/'),
 ('exact_mandaat_import','import','naam','','','relatiecode,kenmerk','iban','NULL::uuid','(SELECT o.id FROM public.ondernemingen o WHERE o.exact_relatie_code=t.relatiecode AND o.samengevoegd_naar IS NULL LIMIT 1)','NULL::uuid','/admin/zoekrecord/exact_mandaat_import/'),
 ('exact_telefoon_import','import','','','telefoon','relatiecode','','NULL::uuid','(SELECT o.id FROM public.ondernemingen o WHERE o.exact_relatie_code=t.relatiecode AND o.samengevoegd_naar IS NULL LIMIT 1)','NULL::uuid','/admin/zoekrecord/exact_telefoon_import/'),
 ('exact_email_import','import','naam','email','','relatiecode','','NULL::uuid','(SELECT o.id FROM public.ondernemingen o WHERE o.exact_relatie_code=t.relatiecode AND o.samengevoegd_naar IS NULL LIMIT 1)','NULL::uuid','/admin/zoekrecord/exact_email_import/'),
 ('invoices','facturen','client_name,company_name','','','invoice_number,kvk_nummer,client_postcode','bank_account','lead_id','NULL::uuid','NULL::uuid','/admin/leads/'),
 ('portal_invitations','portal','','email','','','','lead_id','NULL::uuid','NULL::uuid','/admin/leads/'),
 ('sepa_machtiging_bewijs','mandaten','debiteur_naam','','','mandaatkenmerk','iban','CASE WHEN bron_tabel=''leads'' THEN bron_id END','NULL::uuid','NULL::uuid','/admin/zoekrecord/sepa_machtiging_bewijs/'),
 ('bav_nummer_bevestigingen','certificaten','','','','nummer','','NULL::uuid','onderneming_id','NULL::uuid','/admin/klanten/'),
 ('omzetting_beslissingen','certificaten','','','','bav_nummer','','lead_id','naar_onderneming_id','NULL::uuid','/admin/klanten/'),
 ('onderneming_opvolging','certificaten','','','','bav_nummer','','lead_id','naar_onderneming_id','NULL::uuid','/admin/klanten/')
 ) cfg(tab,groep,namen,emails,tels,nummers,bank,lead,bedrijf,persoon,route) LOOP
 SELECT string_agg(format('coalesce(t.%I,'''')',v),' || '' '' || ') INTO fields FROM unnest(string_to_array(concat_ws(',',nullif(c.namen,''),nullif(c.emails,''),nullif(c.nummers,'')),',')) v;
 expr:=CASE WHEN fields IS NULL THEN '''''::text' ELSE 'lower('||fields||')' END;
 IF fields IS NOT NULL THEN EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin ((%s) extensions.gin_trgm_ops)','zoek_'||c.tab||'_tekst_trgm',c.tab,replace(expr,'t.','')); END IF;
 IF c.tab='ondernemingen' THEN expr:=expr||' || '' '' || lower(coalesce(array_to_string(t.kvk_handelsnamen,'' ''),''''))'; END IF;
 IF c.tab='klant_service_aanvragen' THEN expr:=expr||' || '' '' || lower(coalesce(t.details->>''bedrijfsnaam'','''')) || '' '' || lower(coalesce(t.details->>''postcode'',''''))'; END IF;
 SELECT coalesce('concat_ws('' '','||string_agg(format('nullif(t.%I,'''')',v),',')||')','''''::text') INTO titles FROM unnest(string_to_array(c.namen,',')) v;
 SELECT 'coalesce('||coalesce(string_agg(format('nullif(t.%I,'''')',v),',')||',','')||'NULL::text)' INTO mails FROM unnest(string_to_array(c.emails,',')) v;
 SELECT 'ARRAY['||coalesce(string_agg(format('t.%I',v),','),'')||']::text[]' INTO phones FROM unnest(string_to_array(c.tels,',')) v;
 SELECT 'ARRAY['||coalesce(string_agg(format('t.%I',v),','),'')||']::text[]' INTO nums FROM unnest(string_to_array(c.nummers,',')) v;
 SELECT 'ARRAY['||coalesce(string_agg(format('t.%I',v),','),'')||']::text[]' INTO ibans FROM unnest(string_to_array(c.bank,',')) v;
 FOR f IN SELECT unnest(string_to_array(c.tels,',')) LOOP EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (public.zoek_norm_tel(%I))','zoek_'||c.tab||'_'||f||'_norm',c.tab,f); END LOOP;
 FOR f IN SELECT unnest(string_to_array(c.bank,',')) LOOP EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (right(public.zoek_norm_compact(%I),4))','zoek_'||c.tab||'_'||f||'_laatste4',c.tab,f); END LOOP;
 branches:=array_append(branches,format('SELECT %L::text bron,%L::text groep,t.id,%s titel,%s zoektekst,%s telefoons,%s nummers,%s ibans,%s lead_id,%s onderneming_id,%s persoon_id,%L::text route,coalesce(to_jsonb(t)->>''status'','''') status,coalesce(to_jsonb(t)->>''type'','''') soort,(coalesce((to_jsonb(t)->>''is_test'')::boolean,false) OR coalesce(to_jsonb(t)->>''bron'','''')=''test'') is_test,%s email FROM public.%I t',c.tab,c.groep,titles,expr,phones,nums,ibans,c.lead,c.bedrijf,c.persoon,c.route,mails,c.tab));
 END LOOP;
 EXECUTE 'CREATE OR REPLACE VIEW public.admin_zoek_bronnen AS '||array_to_string(branches,E'\nUNION ALL\n');
END $sources$;
REVOKE ALL ON public.admin_zoek_bronnen FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_zoek_bronnen TO service_role;
CREATE OR REPLACE FUNCTION public.zoek_universeel(_zoek text,_met_test boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $function$
DECLARE me uuid:=auth.uid(); q text:=lower(btrim(coalesce(_zoek,''))); compact text; tel text; suffix text; fulliban boolean; result jsonb; hits int;
BEGIN
 IF me IS NULL OR NOT public.is_team_member(me) OR NOT (public.has_role(me,'verzekering') OR public.is_supervisor_or_admin(me)) THEN RAISE EXCEPTION 'Geen toegang tot klantzoeken'; END IF;
 IF coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Log in met je tweestapscode om te zoeken'; END IF;
 IF length(q)>120 THEN RAISE EXCEPTION 'Zoekterm maximaal 120 tekens'; END IF;
 IF length(q)<2 THEN RETURN '{}'::jsonb; END IF;
 _met_test:=coalesce(_met_test,false) AND public.is_supervisor_or_admin(me);
 compact:=public.zoek_norm_compact(q);
 tel:=CASE WHEN q ~ '^[0-9\s+()./-]+$' THEN public.zoek_norm_tel(q) END;
 fulliban:=compact ~ '^[a-z]{2}[0-9]{2}[a-z0-9]{11,30}$';
 suffix:=CASE WHEN compact ~ '^[0-9]{4}$' THEN compact END;
 WITH RECURSIVE maps AS (
 SELECT id origin,id,samengevoegd_naar,ARRAY[id] path FROM public.ondernemingen
 UNION ALL SELECT m.origin,o.id,o.samengevoegd_naar,m.path||o.id FROM maps m JOIN public.ondernemingen o ON o.id=m.samengevoegd_naar WHERE NOT o.id=ANY(m.path) AND cardinality(m.path)<20
 ), canonical AS (SELECT DISTINCT ON(origin) origin,id FROM maps ORDER BY origin,cardinality(path) DESC), candidates AS (
 SELECT b.*, c.id hoofd_id,o.naam hoofd_naam,o.is_test hoofd_test,l.is_test lead_test,l.voornaam,l.achternaam,l.bedrijfsnaam,l.email lead_email,l.telefoon lead_tel,l.kvk_nummer,o.kvk,o.exact_relatie_code,o.postcode,
 o.naam||' '||coalesce(o.kvk,'')||' '||coalesce(o.exact_relatie_code,'')||' '||coalesce(o.factuur_email,'') gekoppeld_tekst,
 p.telefoon persoon_tel,p.is_test persoon_test,contact.tekst contact_tekst,contact.tels contact_tels,
 EXISTS(SELECT 1 FROM unnest(b.ibans) i WHERE (fulliban AND public.zoek_norm_compact(i)=compact) OR (suffix IS NOT NULL AND right(public.zoek_norm_compact(i),4)=suffix)) iban_match
 FROM public.admin_zoek_bronnen b
 LEFT JOIN public.leads l ON l.id=b.lead_id
 LEFT JOIN canonical c ON c.origin=b.onderneming_id
 LEFT JOIN public.ondernemingen o ON o.id=c.id
 LEFT JOIN public.personen p ON p.id=b.persoon_id
 LEFT JOIN LATERAL (SELECT string_agg(concat_ws(' ',pp.voornaam,pp.achternaam,pp.genormaliseerd_email),' ') tekst,array_agg(pp.telefoon) tels FROM public.persoon_onderneming po JOIN public.personen pp ON pp.id=po.persoon_id WHERE po.onderneming_id IN (b.onderneming_id,c.id) AND (_met_test OR NOT pp.is_test)) contact ON true
 ), matched AS (
 SELECT *,CASE WHEN iban_match THEN 100 WHEN tel IS NOT NULL AND (tel=public.zoek_norm_tel(lead_tel) OR tel=public.zoek_norm_tel(persoon_tel) OR EXISTS(SELECT 1 FROM unnest(telefoons||coalesce(contact_tels,ARRAY[]::text[])) t WHERE public.zoek_norm_tel(t)=tel)) THEN 95 ELSE 80 END score
 FROM candidates b
 WHERE (_met_test OR NOT (b.is_test OR coalesce(hoofd_test,false) OR coalesce(lead_test,false) OR coalesce(persoon_test,false)))
 AND (iban_match OR (NOT fulliban AND (
 id::text=q OR strpos(zoektekst,q)>0 OR strpos(lower(coalesce(contact_tekst,'')),q)>0 OR strpos(lower(coalesce(gekoppeld_tekst,'')),q)>0 OR strpos(lower(concat_ws(' ',voornaam,achternaam,bedrijfsnaam,lead_email)),q)>0
 OR (length(compact)>=3 AND EXISTS(SELECT 1 FROM unnest(nummers||ARRAY[kvk,kvk_nummer,exact_relatie_code,postcode]) n WHERE strpos(public.zoek_norm_compact(n),compact)>0))
 OR (tel IS NOT NULL AND (tel=public.zoek_norm_tel(lead_tel) OR tel=public.zoek_norm_tel(persoon_tel) OR EXISTS(SELECT 1 FROM unnest(telefoons||coalesce(contact_tels,ARRAY[]::text[])) t WHERE public.zoek_norm_tel(t)=tel)))
 )))
 ), payload AS (
 SELECT groep,score,jsonb_build_object('id',CASE WHEN groep='klanten' THEN coalesce(hoofd_id,id) ELSE id END,'bron_id',id,'bron',bron,'titel',coalesce(nullif(titel,''),nullif(hoofd_naam,''),nullif(concat_ws(' ',voornaam,achternaam),''),nullif(email,''),'Onbekend'),
 'score',score,'redenen',jsonb_build_array(CASE WHEN iban_match THEN 'IBAN '||public.zoek_masker_iban((SELECT i FROM unnest(ibans) i WHERE (fulliban AND public.zoek_norm_compact(i)=compact) OR (suffix IS NOT NULL AND right(public.zoek_norm_compact(i),4)=suffix) LIMIT 1))||' komt overeen' WHEN hoofd_id IS NOT NULL AND hoofd_id<>onderneming_id THEN 'Oude kaart, samengevoegd naar '||hoofd_naam ELSE 'Gevonden in '||bron END),
 'onderneming_id',hoofd_id,'email',coalesce(email,lead_email),'telefoon',coalesce(telefoons[1],lead_tel,persoon_tel),'kvk',coalesce(kvk,kvk_nummer),'exact_relatie_code',exact_relatie_code,'status',status,'type',soort,'is_test',is_test,
 'iban',CASE WHEN iban_match THEN public.zoek_masker_iban((SELECT i FROM unnest(ibans) i WHERE (fulliban AND public.zoek_norm_compact(i)=compact) OR (suffix IS NOT NULL AND right(public.zoek_norm_compact(i),4)=suffix) LIMIT 1)) END,
 'link',CASE WHEN route='/admin/klanten/' THEN CASE WHEN hoofd_id IS NOT NULL THEN route||hoofd_id WHEN lead_id IS NOT NULL THEN '/admin/leads/'||lead_id ELSE '/admin/zoekrecord/'||bron||'/'||id END WHEN route='/admin/leads/' THEN CASE WHEN lead_id IS NOT NULL THEN route||lead_id ELSE '/admin/zoekrecord/'||bron||'/'||id END WHEN bron='bav_aanmeldingen' AND lead_id IS NOT NULL THEN '/admin/leads/'||lead_id ELSE route||id END,
 'lead_link',CASE WHEN lead_id IS NOT NULL THEN '/admin/leads/'||lead_id END) j,iban_match
 FROM matched
 ), groups AS (SELECT groep,jsonb_agg(j ORDER BY score DESC,j->>'titel',j->>'bron_id') items FROM payload GROUP BY groep)
 SELECT coalesce((SELECT jsonb_object_agg(groep,items) FROM groups),'{}'::jsonb),(SELECT count(*)::int FROM payload WHERE iban_match) INTO result,hits;
 IF fulliban OR suffix IS NOT NULL THEN
 INSERT INTO public.sensitive_audit_log(target_table,actie,veld,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol,details)
 VALUES('zoeken','zoeken_iban','iban',me,auth.jwt()->>'email',public.get_user_role_label(me),jsonb_build_object('zoekterm_gemaskeerd',CASE WHEN fulliban THEN public.zoek_masker_iban(compact) ELSE '****'||suffix END,'iban_treffers',hits));
 END IF;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.zoek_universeel(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.zoek_universeel(text,boolean) TO authenticated;