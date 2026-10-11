DO $m$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.scherm_data()'::regprocedure);
  n := replace(d,
    $a$'certificaten_week', (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),$a$,
    $a$'certificaten_week', (SELECT count(*) FROM public.policies WHERE NOT coalesce(is_test,false) AND certificate_number IS NOT NULL AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam') + (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND coalesce(bron,'') NOT LIKE '%\_20261001' AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),$a$);
  n := replace(n,
    $a$'certificaten_maand', (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),$a$,
    $a$'certificaten_maand', (SELECT count(*) FROM public.policies WHERE NOT coalesce(is_test,false) AND certificate_number IS NOT NULL AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam') + (SELECT count(*) FROM public.klant_certificaten WHERE NOT coalesce(is_test,false) AND coalesce(bron,'') NOT LIKE '%\_20261001' AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam'),$a$);
  IF n = d OR position('policies' in n) = 0 THEN RAISE EXCEPTION 'scherm_data niet aangepast'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.machine_trg_simpel()'::regprocedure);
  n := replace(d, $a$'Serviceverzoek binnen: ' || replace(coalesce(j->>'type','overig'),'_',' ')$a$, $a$'Serviceverzoek binnen, wordt opgepakt'$a$);
  n := replace(n, $a$'Platform verbeterd: ' || coalesce(j->>'titel','')$a$, $a$'Platform verbeterd door het team'$a$);
  IF position('Serviceverzoek binnen: ' in n) > 0 OR position('Platform verbeterd: ' in n) > 0 THEN RAISE EXCEPTION 'trigger niet aangepast'; END IF;
  EXECUTE n;
END $m$;