-- Live-scherm: stationtellers en processtappen tellen controlerondes (actie 'cron') niet meer als werk.
-- gebeurtenissen_vandaag (kop) blijft bewust cron-runs meetellen (eerder besluit).
DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.scherm_stromen()'::regprocedure);
  IF position('actie IS DISTINCT FROM ''cron''' IN d) = 0 THEN
    d := replace(d, 'WHERE NOT is_test AND (created_at AT TIME ZONE ''Europe/Amsterdam'')::date=(now() AT TIME ZONE ''Europe/Amsterdam'')::date GROUP BY 1,2,3',
                    'WHERE NOT is_test AND actie IS DISTINCT FROM ''cron'' AND (created_at AT TIME ZONE ''Europe/Amsterdam'')::date=(now() AT TIME ZONE ''Europe/Amsterdam'')::date GROUP BY 1,2,3');
    IF position('actie IS DISTINCT FROM ''cron''' IN d) = 0 THEN RAISE EXCEPTION 'scherm_stromen: patroon niet gevonden'; END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef('public.scherm_data()'::regprocedure);
  IF position('m.actie IS DISTINCT FROM ''cron''' IN d) = 0 THEN
    d := replace(d, 'WHERE m.station = s.station AND NOT m.is_test AND (m.created_at',
                    'WHERE m.station = s.station AND NOT m.is_test AND m.actie IS DISTINCT FROM ''cron'' AND (m.created_at');
    IF position('m.actie IS DISTINCT FROM ''cron''' IN d) = 0 THEN RAISE EXCEPTION 'scherm_data: patroon niet gevonden'; END IF;
    EXECUTE d;
  END IF;
END
$mig$;