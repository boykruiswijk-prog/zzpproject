-- A7-aanvulling 2 (Boy 15-10-2026): netto groei telt vanaf 1 okt 2026 (start platform). Alleen de default wijzigt; telregels ongewijzigd.
CREATE OR REPLACE FUNCTION public.tel_netto_groei(_vanaf date DEFAULT date '2026-10-01', _toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date; res jsonb;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  IF _toon_test AND auth.role() <> 'service_role' AND NOT public.is_supervisor_or_admin(auth.uid()) THEN _toon_test := false; END IF;
  WITH k AS (
    SELECT c.id, c.begin_datum, c.status, public.contract_opzegging(c.id) opz FROM public.klant_contracten c JOIN public.ondernemingen o ON o.id = c.onderneming_id
     WHERE c.product IN ('bav_avb','cyber_clear') AND (_toon_test OR (NOT c.is_test AND NOT coalesce(o.is_test,false)))
  ), weken AS (
    SELECT w::date wk FROM generate_series(date_trunc('week', _vanaf), date_trunc('week', v_vandaag), interval '1 week') w
  ), per AS (
    SELECT weken.wk, greatest(weken.wk, _vanaf) van, least(weken.wk + 6, v_vandaag) tot FROM weken
  ), tel AS (
    SELECT per.wk, per.van, per.tot,
      (SELECT count(*) FROM k WHERE k.status <> 'vervangen' AND k.begin_datum BETWEEN per.van AND per.tot) instroom,
      (SELECT count(*) FROM k WHERE k.opz BETWEEN per.van AND per.tot) opgezegd,
      (SELECT count(*) FROM public.incasso_mislukt m WHERE m.status = 'geroyeerd' AND m.geroyeerd_op BETWEEN per.van AND per.tot AND (_toon_test OR NOT m.is_test)) geroyeerd,
      (SELECT count(*) FROM public.klant_service_aanvragen a WHERE a.type = 'opzeggen' AND a.koppeling_methode = 'circle8_collectief'
          AND (a.opzegging_verwerkt_op AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN per.van AND per.tot AND (_toon_test OR NOT a.is_test)) circle8,
      (SELECT count(*) FROM k WHERE k.status <> 'vervangen' AND k.begin_datum < per.van AND (k.opz IS NULL OR k.opz >= per.van)) actief_begin
    FROM per
  ), tot AS (
    SELECT sum(instroom) instroom, sum(opgezegd) opgezegd, sum(geroyeerd) geroyeerd, sum(circle8) circle8,
      (SELECT count(*) FROM k WHERE k.status <> 'vervangen' AND k.begin_datum < _vanaf AND (k.opz IS NULL OR k.opz >= _vanaf)) actief_begin FROM tel
  )
  SELECT jsonb_build_object(
    'vanaf', _vanaf, 'tot', v_vandaag,
    'weken', coalesce((SELECT jsonb_agg(jsonb_build_object('week', to_char(wk, 'IYYY-"W"IW'), 'van', van, 'tot', tot, 'instroom', instroom,
        'beeindigingen', opgezegd + geroyeerd, 'opgezegd', opgezegd, 'geroyeerd', geroyeerd, 'circle8_opzeggingen', circle8,
        'netto_groei', instroom - opgezegd - geroyeerd, 'actief_begin', actief_begin,
        'opzegpercentage', CASE WHEN actief_begin = 0 THEN NULL ELSE round(100.0 * (opgezegd + geroyeerd) / actief_begin, 1) END) ORDER BY wk) FROM tel), '[]'::jsonb),
    'cumulatief', (SELECT jsonb_build_object('instroom', instroom, 'beeindigingen', opgezegd + geroyeerd, 'opgezegd', opgezegd, 'geroyeerd', geroyeerd,
        'circle8_opzeggingen', circle8, 'netto_groei', instroom - opgezegd - geroyeerd, 'actief_begin', actief_begin,
        'opzegpercentage', CASE WHEN actief_begin = 0 THEN NULL ELSE round(100.0 * (opgezegd + geroyeerd) / actief_begin, 1) END) FROM tot)
  ) INTO res;
  RETURN res;
END $f$;
REVOKE ALL ON FUNCTION public.tel_netto_groei(date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tel_netto_groei(date,boolean) TO authenticated, service_role;

-- Database-default is de enige bron: dashboard_tellers en scherm_data roepen tel_netto_groei zonder _vanaf aan.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.dashboard_tellers(boolean)'::regprocedure);
  d := replace(d, 'public.tel_netto_groei(date ''2026-10-06'', _toon_test)', 'public.tel_netto_groei(_toon_test => _toon_test)');
  IF position('tel_netto_groei(_toon_test => _toon_test)' IN d) = 0 THEN RAISE EXCEPTION 'dashboard_tellers: aanroep niet gevonden'; END IF;
  EXECUTE d;
  d := pg_get_functiondef('public.scherm_data()'::regprocedure);
  d := replace(d, 'public.tel_netto_groei(date ''2026-10-06'', false)', 'public.tel_netto_groei(_toon_test => false)');
  IF position('tel_netto_groei(_toon_test => false)' IN d) = 0 THEN RAISE EXCEPTION 'scherm_data: aanroep niet gevonden'; END IF;
  EXECUTE d;
END $do$;