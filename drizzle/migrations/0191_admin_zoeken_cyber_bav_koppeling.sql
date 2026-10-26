DO $fix$
DECLARE d text;
BEGIN
SELECT pg_get_functiondef('public.zoek_universeel(text,boolean)'::regprocedure) INTO d;
d:=replace(d,'p.telefoon persoon_tel,p.is_test persoon_test,contact.tekst contact_tekst,contact.tels contact_tels,','p.telefoon persoon_tel,p.is_test persoon_test,contact.tekst contact_tekst,contact.tels contact_tels, nummers_klant.nummers klant_nummers,');
d:=replace(d,'), matched AS (',E' LEFT JOIN LATERAL (SELECT array_agg(k.abonnement_nr) nummers FROM public.klant_contracten k WHERE k.onderneming_id IN (b.onderneming_id,c.id) AND (_met_test OR NOT k.is_test)) nummers_klant ON true\n ), matched AS (');
d:=replace(d,'unnest(nummers||ARRAY[kvk,kvk_nummer,exact_relatie_code,postcode])','unnest(nummers||coalesce(klant_nummers,ARRAY[]::text[])||ARRAY[kvk,kvk_nummer,exact_relatie_code,postcode])');
d:=replace(d,'''exact_relatie_code'',exact_relatie_code,''status''','''exact_relatie_code'',exact_relatie_code,''bav_nummer'',klant_nummers[1],''status''');
EXECUTE d;
END $fix$;
REVOKE ALL ON FUNCTION public.zoek_universeel(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.zoek_universeel(text,boolean) TO authenticated;