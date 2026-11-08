-- Same A8 projection rule for the named Puls heartbeat variants, without changing producers.
DO $block$
DECLARE definitie text;
BEGIN
 SELECT pg_get_viewdef('public.scherm_machine_live'::regclass,true) INTO definitie;
 EXECUTE 'CREATE OR REPLACE VIEW public.scherm_machine_live AS ' || replace(definitie,
 'FROM machine_activiteit m',
 'FROM (SELECT * FROM public.machine_activiteit WHERE NOT (status = ''klaar'' AND (tekst IN (''Puls: aanvraagstroom in orde'', ''Puls (Hartslag): alles in orde'') OR bron = ''agent:puls''))) m');
END $block$;
REVOKE ALL ON public.scherm_machine_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.scherm_machine_live TO service_role;