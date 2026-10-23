DO $migration$
DECLARE d text; n text;
BEGIN
 SELECT pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure) INTO d;
 n := replace(d, 'AND (l.status IN (''nieuw'',''nieuw_te_beoordelen'') OR', 'AND NOT (l.type = ''verzekering_aanvraag'' AND l.status = ''actief'') AND (l.status IN (''nieuw'',''nieuw_te_beoordelen'') OR');
 n := replace(n, 'AND l.status NOT IN (''afgewezen'',''opgezegd'',''nieuw'',''nieuw_te_beoordelen'',''afgerond'')', 'AND l.status NOT IN (''actief'',''afgewezen'',''opgezegd'',''nieuw'',''nieuw_te_beoordelen'',''afgerond'')');
 n := replace(n, 'SELECT l.* FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.vlag IS NOT NULL', 'SELECT l.* FROM leads l WHERE (_toon_test OR NOT l.is_test) AND NOT (l.type = ''verzekering_aanvraag'' AND l.status = ''actief'') AND l.vlag IS NOT NULL');
 IF n=d OR position('''actief'',''afgewezen'',''opgezegd'',''nieuw''' IN n)=0 THEN RAISE EXCEPTION 'Aanvraagpredicaten ontbreken'; END IF;
 EXECUTE n;
END $migration$;
COMMENT ON FUNCTION public.mijn_acties_vandaag(boolean) IS 'Actieve aanvragen zijn geen open aanvraag of opvolgactie; echte polisbeheeracties blijven behouden. tel_acties_vandaag deelt deze bron met admin en scherm.';