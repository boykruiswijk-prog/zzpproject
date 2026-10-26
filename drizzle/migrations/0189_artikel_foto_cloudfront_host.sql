DO $migration$
DECLARE definition text; old_hosts text := '''cdn.higgsfield.ai'',''static-public-media.higgsfield.ai'',''static.higgsfield.ai''';
BEGIN
 SELECT pg_get_functiondef('public.artikel_foto_vastleggen(uuid,uuid,jsonb)'::regprocedure) INTO definition;
 IF position(old_hosts IN definition)=0 THEN RAISE EXCEPTION 'Bestaande foto-hostcontrole niet gevonden'; END IF;
 EXECUTE replace(definition,old_hosts,old_hosts||',''d8j0ntlcm91z4.cloudfront.net''');
END $migration$;
REVOKE ALL ON FUNCTION public.artikel_foto_vastleggen(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_foto_vastleggen(uuid,uuid,jsonb) TO service_role;