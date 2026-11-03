DO $do$
DECLARE f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.persoon_onderneming_koppelen(uuid,uuid)','public.persoon_onderneming_ontkoppelen(uuid,uuid,text)'] LOOP
    src := pg_get_functiondef(f::regprocedure);
    src := replace(src, 'SELECT coalesce(nullif(btrim(coalesce(pr.full_name,'''')),''''), pr.email) INTO _naam FROM public.profiles pr WHERE pr.user_id = me;',
                        'SELECT nullif(btrim(coalesce(pr.full_name,'''')),'''') INTO _naam FROM public.profiles pr WHERE pr.id = me;');
    EXECUTE src;
  END LOOP;
END $do$;