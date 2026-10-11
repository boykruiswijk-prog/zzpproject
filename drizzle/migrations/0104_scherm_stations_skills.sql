DO $mig$
DECLARE d text := pg_get_functiondef('public.scherm_data'::regproc);
BEGIN
  d := replace(d, $a$jsonb_build_object('vandaag', vandaag, 'laatste_status', laatste_status)$a$, $a$jsonb_build_object('vandaag', vandaag, 'skills', skills, 'laatste_status', laatste_status)$a$);
  d := replace(d, $a$= v_vandaag) AS vandaag,$a$, $a$= v_vandaag) AS vandaag,
          (SELECT count(DISTINCT coalesce(m.actie,'')) FROM public.scherm_machine_live m WHERE m.station = s.station AND NOT m.is_test AND (m.created_at AT TIME ZONE 'Europe/Amsterdam')::date = v_vandaag) AS skills,$a$);
  IF position('AS skills' in d) = 0 THEN RAISE EXCEPTION 'patch mislukt'; END IF;
  EXECUTE d;
END $mig$;