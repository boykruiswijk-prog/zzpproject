-- Besluit Boy 13-11 (register 7, A6): tv volgt de admin-telling. Klant = onderneming (niet-test) met minstens één contract
-- in status actief, loopt_af of einddatum_controle; telt ook nog niet gestarte en gratis contracten; beëindigd en vervangen tellen niet.
CREATE OR REPLACE FUNCTION public.tel_klanten_set(_toon_test boolean DEFAULT false)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT k.onderneming_id FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND (_toon_test OR (NOT k.is_test AND NOT coalesce(o.is_test,false)))
$$;

-- Stand aan het begin van _op (dus eind van de dag ervoor), met dezelfde definitie: contract bestond al
-- (begin_datum of registratie voor _op) en was niet vóór _op beëindigd (opzegging, of einde van een niet-lopend contract).
CREATE OR REPLACE FUNCTION public.tel_klanten_set_op(_op date, _toon_test boolean DEFAULT false)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT k.onderneming_id FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE (_toon_test OR (NOT k.is_test AND NOT coalesce(o.is_test,false)))
     AND (k.begin_datum < _op OR (k.created_at AT TIME ZONE 'Europe/Amsterdam')::date < _op)
     AND coalesce(public.contract_opzegging(k.id),
           CASE WHEN k.status IN ('actief','loopt_af','einddatum_controle') THEN NULL
                ELSE coalesce(k.eind_datum, (k.updated_at AT TIME ZONE 'Europe/Amsterdam')::date) END, date '9999-12-31') >= _op
$$;

CREATE OR REPLACE FUNCTION public.tel_klanten_stand(_vanaf date, _toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  WITH n AS (SELECT * FROM public.tel_klanten_set(_toon_test) id), b AS (SELECT * FROM public.tel_klanten_set_op(_vanaf, _toon_test) id)
  SELECT jsonb_build_object('van', _vanaf, 'begin', (SELECT count(*) FROM b),
    'instroom', (SELECT count(*) FROM (SELECT id FROM n EXCEPT SELECT id FROM b) x),
    'uitstroom', (SELECT count(*) FROM (SELECT id FROM b EXCEPT SELECT id FROM n) x),
    'nu', (SELECT count(*) FROM n)) INTO r;
  r := r || jsonb_build_object('netto', (r->>'instroom')::int - (r->>'uitstroom')::int);
  IF (r->>'begin')::int + (r->>'netto')::int <> (r->>'nu')::int OR (r->>'nu')::bigint <> public.tel_klanten(_toon_test) THEN
    RAISE EXCEPTION 'Netto groei klanten sluit niet op tel_klanten'; END IF;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.tel_klanten_set(boolean), public.tel_klanten_set_op(date,boolean), public.tel_klanten_stand(date,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tel_klanten_set(boolean), public.tel_klanten_set_op(date,boolean), public.tel_klanten_stand(date,boolean) TO service_role;

-- tel_netto_groei: cumulatief nu in klanten (sluit op tel_klanten); oude contracttelling blijft als detail in contracten_cumulatief.
DO $do$
DECLARE d text := pg_get_functiondef('public.tel_netto_groei(date,boolean)'::regprocedure);
BEGIN
  d := replace(d, $a$'cumulatief', (SELECT jsonb_build_object($a$, $a$'contracten_cumulatief', (SELECT jsonb_build_object($a$);
  d := replace(d, $a$res := res || jsonb_build_object('instroom_opbouw',public.tel_instroom_opbouw(_vanaf,_toon_test));$a$,
    $a$res := res || jsonb_build_object('instroom_opbouw',public.tel_instroom_opbouw(_vanaf,_toon_test));
  DECLARE ks jsonb := public.tel_klanten_stand(_vanaf, _toon_test); kw jsonb := public.tel_klanten_stand(date_trunc('week', v_vandaag)::date, _toon_test);
  BEGIN
    res := res || jsonb_build_object('klanten', ks, 'klanten_week', kw,
      'cumulatief', jsonb_build_object('instroom', ks->'instroom', 'beeindigingen', ks->'uitstroom', 'netto_groei', ks->'netto',
         'actief_begin', ks->'begin', 'nu', ks->'nu', 'circle8_opzeggingen', res#>'{contracten_cumulatief,circle8_opzeggingen}',
         'opzegpercentage', CASE WHEN (ks->>'begin')::int = 0 THEN NULL ELSE round(100.0 * (ks->>'uitstroom')::int / (ks->>'begin')::int, 1) END));
  END;$a$);
  d := replace(d, $a$(res#>>'{cumulatief,instroom}')::bigint <>$a$, $a$(res#>>'{contracten_cumulatief,instroom}')::bigint <>$a$);
  IF d NOT LIKE '%tel_klanten_stand%' OR d NOT LIKE '%contracten_cumulatief,instroom%' THEN RAISE EXCEPTION 'tel_netto_groei vervanging mislukt'; END IF;
  EXECUTE d;
END $do$;

-- scherm_groei: exact de admin-tellers, geen eigen telling.
CREATE OR REPLACE FUNCTION public.scherm_groei()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  ks jsonb := public.tel_klanten_stand(date '2026-10-01', false);
  kw jsonb := public.tel_klanten_stand(date_trunc('week', v_vandaag)::date, false);
  res jsonb;
BEGIN
  WITH nu AS (SELECT k.product FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
     WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND NOT k.is_test AND NOT coalesce(o.is_test,false))
  SELECT jsonb_build_object(
    'klanten', public.tel_klanten(false), 'contracten', public.tel_contracten(false),
    'bav_avb', (SELECT count(*) FROM nu WHERE product IN ('bav_avb','nimble_bav')),
    'cyber', (SELECT count(*) FROM nu WHERE product = 'cyber_clear'),
    'lidmaatschap', (SELECT count(*) FROM nu WHERE product LIKE 'lidmaatschap%'),
    'overig', (SELECT count(*) FROM nu WHERE product NOT IN ('bav_avb','nimble_bav','cyber_clear') AND product NOT LIKE 'lidmaatschap%'),
    'sinds', jsonb_build_object('van', ks->'van', 'begin', ks->'begin', 'nieuw', ks->'instroom', 'gestopt', ks->'uitstroom', 'nu', ks->'nu'),
    'week', jsonb_build_object('van', kw->'van', 'begin', kw->'begin', 'nieuw', kw->'instroom', 'gestopt', kw->'uitstroom', 'nu', kw->'nu')
  ) INTO res;
  RETURN res;
END $$;