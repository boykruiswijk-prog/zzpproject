-- Databasetest rechtsvormwijziging met overlap (besluit Boy 12-11-2026 12:11). Eindigt met RAISE, alles wordt teruggedraaid.
DO $$
DECLARE r jsonb; e date;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM user_roles WHERE role='admin' LIMIT 1), 'role','authenticated','aal','aal2')::text, true);
  r := public.crm_ondernemingswijziging('e4104723-0000-4000-8000-000000000001', NULL, 'Rollbacktest BV', '99887766', 'BV', '2026-12-01', 'overname', 'rollbacktest', true, false, '2026-12-31');
  SELECT eind_datum INTO e FROM klant_contracten WHERE id = 'e4104723-0000-4000-8000-000000000004';
  IF e IS DISTINCT FROM '2026-12-31'::date THEN RAISE EXCEPTION 'FOUT einddatum %', e; END IF;
  RAISE EXCEPTION 'ALLES OK, rollback';
END $$;
