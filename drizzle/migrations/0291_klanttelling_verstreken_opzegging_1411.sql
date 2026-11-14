-- Besluit Boy 14-11 09:00 (A6): alleen een vastgelegde opzegging vóór de peildatum sluit uit.
-- Een verstreken eind_datum zonder vastgelegde opzegging blijft juist meetellen.
CREATE OR REPLACE FUNCTION public.tel_klanten(_toon_test boolean DEFAULT false)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(DISTINCT k.onderneming_id) FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle')
     AND coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= (now() AT TIME ZONE 'Europe/Amsterdam')::date
     AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
$$;

CREATE OR REPLACE FUNCTION public.tel_contracten(_toon_test boolean DEFAULT false)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*) FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle')
     AND coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= (now() AT TIME ZONE 'Europe/Amsterdam')::date
     AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
$$;

CREATE OR REPLACE FUNCTION public.tel_klanten_set(_toon_test boolean DEFAULT false)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT k.onderneming_id FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.status IN ('actief','loopt_af','einddatum_controle')
     AND coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= (now() AT TIME ZONE 'Europe/Amsterdam')::date
     AND (_toon_test OR (NOT k.is_test AND NOT coalesce(o.is_test,false)))
$$;

-- Stand aan het begin van _op. Vervanging houdt zijn eigen levenscyclus; eind_datum wordt nooit als opzegging gebruikt.
CREATE OR REPLACE FUNCTION public.tel_klanten_set_op(_op date, _toon_test boolean DEFAULT false)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT k.onderneming_id FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE (_toon_test OR (NOT k.is_test AND NOT coalesce(o.is_test,false)))
     AND (k.begin_datum < _op OR (k.created_at AT TIME ZONE 'Europe/Amsterdam')::date < _op)
     AND coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= _op
     AND (k.status <> 'vervangen' OR (k.updated_at AT TIME ZONE 'Europe/Amsterdam')::date >= _op)
$$;

-- Houd ook de productsplitsing gelijk aan tel_contracten.
CREATE OR REPLACE FUNCTION public.scherm_groei()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  ks jsonb := public.tel_klanten_stand(date '2026-10-01', false);
  kw jsonb := public.tel_klanten_stand(date_trunc('week', v_vandaag)::date, false);
  res jsonb;
BEGIN
  WITH nu AS (SELECT k.product FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
     WHERE k.status IN ('actief','loopt_af','einddatum_controle')
       AND coalesce(public.contract_opzegging(k.id), date '9999-12-31') >= v_vandaag
       AND NOT k.is_test AND NOT coalesce(o.is_test,false))
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

CREATE OR REPLACE FUNCTION public._ts_telling_admin_tv()
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  s jsonb; n jsonb; t jsonb; c jsonb := '[]';
  k uuid; k2 uuid; voor bigint;
  vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  ond_c constant uuid := '7e570000-0000-4000-8000-000000000011';
  ond_d constant uuid := '7e570000-0000-4000-8000-000000000012';
BEGIN
  s := public.scherm_groei(); n := public.tel_netto_groei(date '2026-10-01', false);
  c := c || public._ts_c('tv klanten = tel_klanten', public.tel_klanten(false)::text, s->>'klanten')
         || public._ts_c('tv contracten = tel_contracten', public.tel_contracten(false)::text, s->>'contracten')
         || public._ts_c('tv productsplitsing = contracten', s->>'contracten', ((s->>'bav_avb')::int+(s->>'cyber')::int+(s->>'lidmaatschap')::int+(s->>'overig')::int)::text)
         || public._ts_c('tv sinds = admin netto groei', n->'klanten'->>'begin' || '+' || (n->'klanten'->>'instroom') || '-' || (n->'klanten'->>'uitstroom'),
                         (s->'sinds'->>'begin') || '+' || (s->'sinds'->>'nieuw') || '-' || (s->'sinds'->>'gestopt'))
         || public._ts_c('netto groei sluit op tel_klanten', public.tel_klanten(false)::text,
                         ((n->'cumulatief'->>'actief_begin')::int + (n->'cumulatief'->>'netto_groei')::int)::text)
         || public._ts_c('week sluit op tel_klanten', public.tel_klanten(false)::text,
                         ((s->'week'->>'begin')::int + (s->'week'->>'nieuw')::int - (s->'week'->>'gestopt')::int)::text);

  -- Twee geïsoleerde testondernemingen: verstreken opzegging telt niet, verlopen einddatum zonder opzegging wel.
  INSERT INTO public.ondernemingen (id, naam, is_test) VALUES
    (ond_c, 'Testtelling verstreken opzegging', true),
    (ond_d, 'Testtelling stilzwijgende verlenging', true);
  voor := public.tel_contracten(true);
  k := public._ts_contract(ond_c, vandaag - 400);
  UPDATE public.klant_contracten SET status = 'loopt_af', eind_datum = vandaag - 1 WHERE id = k;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, details)
  VALUES ('klant_contracten', k, 'opzegging_verwerken', 'eind_datum/status', 'actief', (vandaag - 1)::text || ' / loopt_af', jsonb_build_object('scenario', 'telling_admin_tv_gelijk'));
  k2 := public._ts_contract(ond_d, vandaag - 400);
  UPDATE public.klant_contracten SET eind_datum = vandaag - 1 WHERE id = k2;

  c := c || public._ts_c('verstreken opzegging telt nu niet', '0', (SELECT count(*)::text FROM public.tel_klanten_set(true) AS x(id) WHERE id = ond_c))
         || public._ts_c('verlopen einddatum zonder opzegging telt nu wel', '1', (SELECT count(*)::text FROM public.tel_klanten_set(true) AS x(id) WHERE id = ond_d))
         || public._ts_c('opzegdatum zelf telt historisch nog', '1', (SELECT count(*)::text FROM public.tel_klanten_set_op(vandaag - 1, true) AS x(id) WHERE id = ond_c))
         || public._ts_c('dag na opzegdatum telt historisch niet', '0', (SELECT count(*)::text FROM public.tel_klanten_set_op(vandaag, true) AS x(id) WHERE id = ond_c))
         || public._ts_c('verlopen einddatum zonder opzegging telt historisch wel', '1', (SELECT count(*)::text FROM public.tel_klanten_set_op(vandaag + 1, true) AS x(id) WHERE id = ond_d))
         || public._ts_c('contracttelling neemt alleen verlenging mee', (voor + 1)::text, public.tel_contracten(true)::text);

  -- Met een nieuw testcontract (alleen zichtbaar met toon_test) blijft de telling sluiten en telt de klant als instroom.
  PERFORM public._ts_contract('7e570000-0000-4000-8000-00000000000a', (vandaag + 20));
  t := public.tel_klanten_stand(date '2026-10-01', true);
  c := c || public._ts_c('met testdata sluitend', public.tel_klanten(true)::text, ((t->>'begin')::int + (t->>'netto')::int)::text)
         || public._ts_c('zonder testdata ongewijzigd', s->>'klanten', public.tel_klanten(false)::text);
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_telling_admin_tv() FROM PUBLIC, anon, authenticated;
