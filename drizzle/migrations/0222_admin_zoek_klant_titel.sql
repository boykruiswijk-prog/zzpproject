-- Admin-zoekresultaten groep KLANTEN: ondernemingsnaam en contactpersoon gescheiden tonen.
-- De view-titel blijft de zoekbron; de RPC geeft voor klanten alleen de
-- ondernemingsnaam als titel en de contactpersoon apart als subtitel,
-- zonder de ondernemingsnaam nogmaals te herhalen.
DO $fix$
DECLARE d text;
BEGIN
SELECT pg_get_functiondef('public.zoek_universeel(text,boolean)'::regprocedure) INTO d;
d:=replace(d,'o.naam hoofd_naam,','o.naam hoofd_naam,coalesce(nullif(btrim(coalesce(o.afas_contactpersoon,'''')),''''),nullif(contact_persoon.naam,'''')) klant_contact,');
d:=replace(d,') nummers_klant ON true',E') nummers_klant ON true\n LEFT JOIN LATERAL (SELECT concat_ws('' '',pp.voornaam,pp.achternaam) naam FROM public.persoon_onderneming po JOIN public.personen pp ON pp.id=po.persoon_id WHERE po.onderneming_id IN (b.onderneming_id,c.id) AND (_met_test OR NOT pp.is_test) AND nullif(concat_ws('' '',pp.voornaam,pp.achternaam),'''') IS NOT NULL ORDER BY po.created_at LIMIT 1) contact_persoon ON true');
d:=replace(d,'''titel'',coalesce(nullif(titel,''''),nullif(hoofd_naam,''''),nullif(concat_ws('' '',voornaam,achternaam),''''),nullif(email,''''),''Onbekend''),',
'''titel'',CASE WHEN groep=''klanten'' THEN coalesce(nullif(hoofd_naam,''''),nullif(titel,''''),nullif(concat_ws('' '',voornaam,achternaam),''''),nullif(email,''''),''Onbekend'') ELSE coalesce(nullif(titel,''''),nullif(hoofd_naam,''''),nullif(concat_ws('' '',voornaam,achternaam),''''),nullif(email,''''),''Onbekend'') END,
''subtitel'',CASE WHEN groep=''klanten'' AND lower(public.zoek_norm_compact(coalesce(klant_contact,'''')))<>lower(public.zoek_norm_compact(coalesce(hoofd_naam,''''))) THEN klant_contact END,');
IF position('klant_contact' in d)=0 OR position('subtitel' in d)=0 THEN RAISE EXCEPTION 'zoek_universeel niet aangepast'; END IF;
EXECUTE d;
END $fix$;
REVOKE ALL ON FUNCTION public.zoek_universeel(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.zoek_universeel(text,boolean) TO authenticated;