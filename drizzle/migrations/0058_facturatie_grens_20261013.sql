-- Besluit Boy (06-10-2026): administratie t/m 12-10-2026, platform vanaf 13-10-2026.
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.doorrol_startstand(boolean)'::regprocedure);
  d := replace(d, 'DATE ''2026-10-16''', 'DATE ''2026-10-12''');
  d := replace(d, 'DATE ''2026-10-17''', 'DATE ''2026-10-13''');
  d := replace(d, 'doorrol_20261016', 'doorrol_20261012');
  EXECUTE d;
  d := pg_get_functiondef('public.plan_opzeg_credit(uuid,uuid,date)'::regprocedure);
  d := replace(d, '17-10-2026', '13-10-2026');
  EXECUTE d;
END $$;
COMMENT ON FUNCTION public.doorrol_startstand(boolean) IS 'Startstand: administratie t/m 12-10-2026, platform factureert vanaf 13-10-2026.';