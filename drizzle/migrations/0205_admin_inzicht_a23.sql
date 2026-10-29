CREATE TABLE IF NOT EXISTS public.admin_teller_historie (
  dag date NOT NULL,
  teller text NOT NULL,
  waarde numeric NOT NULL,
  gemeten_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dag, teller)
);
REVOKE ALL ON public.admin_teller_historie FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_teller_historie TO service_role;
ALTER TABLE public.admin_teller_historie ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_teller_momentopname(_forceer boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  nl timestamp := now() AT TIME ZONE 'Europe/Amsterdam';
  vandaag date := nl::date;
  ng jsonb;
BEGIN
  IF NOT _forceer AND extract(hour FROM nl) <> 23 THEN RETURN 0; END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  ng := public.tel_netto_groei(_toon_test => false);
  INSERT INTO public.admin_teller_historie(dag, teller, waarde)
  SELECT vandaag, t, w FROM (VALUES
    ('klanten', public.tel_klanten(false)::numeric),
    ('contracten', public.tel_contracten(false)::numeric),
    ('service_open', public.tel_service_open(false)::numeric),
    ('aanvragen', public.tel_aanvragen_doel(date '2026-10-06')::numeric),
    ('netto_groei', coalesce((ng->'cumulatief'->>'netto_groei')::numeric, 0)),
    ('arr', (SELECT round(coalesce(sum(maandwaarde),0)*12,2) FROM public.klant_contracten WHERE status = 'actief' AND is_test = false)),
    ('loopt_af', (SELECT round(coalesce(sum(maandwaarde),0)*12,2) FROM public.klant_contracten WHERE status = 'loopt_af' AND is_test = false))
  ) v(t, w)
  ON CONFLICT (dag, teller) DO UPDATE SET waarde = EXCLUDED.waarde, gemeten_op = now();
  RETURN 7;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_teller_momentopname(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_teller_momentopname(boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.inzicht_tegel(_tegel text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  d jsonb; a jsonb; huidig numeric; reeks jsonb := '[]'::jsonb; lijst jsonb := '[]'::jsonb;
  extra jsonb := '{}'::jsonb; bron text := 'momentopname'; hist_teller text := _tegel;
  w numeric; m numeric;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT public.is_team_member(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;

  IF _tegel IN ('arr','loopt_af','arr_maand') THEN
    a := public.arr_overzicht();
    huidig := CASE _tegel WHEN 'loopt_af' THEN (a->>'arr_loopt_af')::numeric
                          WHEN 'arr_maand' THEN (a->>'netto_sinds_1_okt')::numeric
                          ELSE (a->>'arr_totaal')::numeric END;
    extra := jsonb_build_object('maanden', a->'maanden', 'arr', a);
    IF _tegel = 'arr_maand' THEN hist_teller := NULL; bron := 'bestaande_data'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'onderneming_id', c.onderneming_id, 'naam', o.naam,
      'product', c.product, 'status', c.status, 'arr', round(c.maandwaarde*12,2), 'begin_datum', c.begin_datum, 'eind_datum', c.eind_datum)
      ORDER BY c.maandwaarde DESC), '[]'::jsonb) INTO lijst
    FROM public.klant_contracten c LEFT JOIN public.ondernemingen o ON o.id = c.onderneming_id
    WHERE c.is_test = false AND (
      (_tegel = 'arr' AND c.status = 'actief') OR (_tegel = 'loopt_af' AND c.status = 'loopt_af')
      OR (_tegel = 'arr_maand' AND c.status IN ('actief','loopt_af') AND (c.begin_datum BETWEEN date '2026-10-01' AND vandaag OR c.eind_datum BETWEEN date '2026-10-01' AND vandaag)));
  ELSIF _tegel = 'vandaag' THEN
    d := public.mijn_acties_vandaag(false);
    huidig := coalesce((d->>'totaal')::numeric, 0);
    extra := jsonb_build_object('acties', d);
    hist_teller := NULL; bron := 'geen';
  ELSE
    d := public.dashboard_tellers(false);
    huidig := CASE _tegel
      WHEN 'klanten' THEN (d->>'klanten')::numeric
      WHEN 'contracten' THEN (d->>'contracten_actief')::numeric
      WHEN 'service_open' THEN (d->>'service_open')::numeric
      WHEN 'aanvragen' THEN (d->>'aanvragen_doel')::numeric
      WHEN 'conversie' THEN (d->>'aanvragen_doel')::numeric
      WHEN 'netto_groei' THEN (d->'netto_groei'->'cumulatief'->>'netto_groei')::numeric
      WHEN 'leads' THEN coalesce((d->'leads_opbouw'->>'totaal')::numeric, (d->>'leads_totaal')::numeric)
      WHEN 'mrr' THEN (d->>'mrr')::numeric
      WHEN 'jaarwaarde' THEN (d->>'arr')::numeric
      WHEN 'opzeggingen' THEN (d->>'opzeggingen_te_koppelen')::numeric
      ELSE NULL END;
    IF _tegel NOT IN ('klanten','contracten','service_open','aanvragen','conversie','netto_groei','leads','mrr','jaarwaarde','opzeggingen') THEN
      RAISE EXCEPTION 'Onbekende tegel' USING ERRCODE = '22023';
    END IF;
    IF _tegel = 'conversie' THEN hist_teller := 'aanvragen'; END IF;
    extra := jsonb_build_object('aanvragen_opbouw', d->'aanvragen_opbouw', 'leads_opbouw', d->'leads_opbouw', 'netto_groei', d->'netto_groei');

    IF _tegel IN ('aanvragen','conversie') THEN
      bron := 'bestaande_data';
      SELECT coalesce(jsonb_agg(jsonb_build_object('dag', dag, 'waarde', n) ORDER BY dag), '[]'::jsonb) INTO reeks
      FROM (SELECT r.dag, count(*) n FROM public.tel_aanvragen_doel_rijen(date '2026-10-06') r GROUP BY r.dag) x;
      SELECT count(*) FILTER (WHERE r.dag <= vandaag - 7), count(*) FILTER (WHERE r.dag <= vandaag - 30)
        INTO w, m FROM public.tel_aanvragen_doel_rijen(date '2026-10-06') r;
      extra := extra || jsonb_build_object('doel', 200, 'doel_van', date '2026-10-06', 'doel_tot', date '2026-12-31', 'doel_dagen', 87,
        'vorige_week', w, 'vorige_maand', m);
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.sleutel, 'dag', c.dag, 'kvk', c.kvk, 'statusgroep', c.statusgroep,
        'lead_id', l.id, 'naam', coalesce(nullif(l.bedrijfsnaam,''), nullif(trim(concat_ws(' ', l.voornaam, l.achternaam)),''))) ORDER BY c.dag DESC), '[]'::jsonb) INTO lijst
      FROM public.tel_aanvraag_cohort(date '2026-10-06') c LEFT JOIN public.leads l ON l.id = c.sleutel;
    ELSIF _tegel = 'klanten' THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'naam', x.naam, 'contracten', x.n) ORDER BY x.naam), '[]'::jsonb) INTO lijst
      FROM (SELECT o.id, o.naam, count(*) n FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
            WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND NOT k.is_test AND NOT o.is_test GROUP BY o.id, o.naam) x;
    ELSIF _tegel = 'contracten' THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'onderneming_id', o.id, 'naam', o.naam, 'product', k.product,
        'status', k.status, 'begin_datum', k.begin_datum, 'eind_datum', k.eind_datum) ORDER BY o.naam), '[]'::jsonb) INTO lijst
      FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
      WHERE k.status IN ('actief','loopt_af','einddatum_controle') AND NOT k.is_test AND NOT o.is_test;
    ELSIF _tegel = 'service_open' THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'type', s.type, 'status', s.status, 'dag', (s.created_at AT TIME ZONE 'Europe/Amsterdam')::date,
        'onderneming_id', s.onderneming_id, 'naam', o.naam) ORDER BY s.created_at DESC), '[]'::jsonb) INTO lijst
      FROM public.klant_service_aanvragen s LEFT JOIN public.ondernemingen o ON o.id = s.onderneming_id
      WHERE NOT s.is_test
        AND coalesce(s.status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')
        AND NOT (s.type = 'opzeggen' AND s.opzegging_verwerkt_op IS NOT NULL)
        AND s.type <> 'portaltoegang';
    ELSIF _tegel IN ('leads','mrr','jaarwaarde','opzeggingen') THEN
      hist_teller := NULL; bron := 'geen';
    END IF;
  END IF;

  IF hist_teller IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('dag', dag, 'waarde', waarde) ORDER BY dag), '[]'::jsonb) INTO d
    FROM public.admin_teller_historie WHERE teller = hist_teller;
    extra := extra || jsonb_build_object('historie', d,
      'meting_vanaf', (SELECT min(dag) FROM public.admin_teller_historie WHERE teller = hist_teller));
    IF bron = 'momentopname' THEN
      extra := extra || jsonb_build_object(
        'vorige_week', (SELECT waarde FROM public.admin_teller_historie WHERE teller = hist_teller AND dag <= vandaag - 7 ORDER BY dag DESC LIMIT 1),
        'vorige_maand', (SELECT waarde FROM public.admin_teller_historie WHERE teller = hist_teller AND dag <= vandaag - 30 ORDER BY dag DESC LIMIT 1));
    END IF;
  END IF;

  RETURN jsonb_build_object('tegel', _tegel, 'peildatum', vandaag, 'huidig', huidig, 'bron', bron,
    'reeks', reeks, 'lijst', lijst) || extra;
END;
$$;
REVOKE ALL ON FUNCTION public.inzicht_tegel(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.inzicht_tegel(text) TO authenticated;