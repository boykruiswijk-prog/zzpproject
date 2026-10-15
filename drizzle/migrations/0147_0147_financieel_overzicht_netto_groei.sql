-- Financieel overzicht (alleen supervisor/admin): Exact alleen lezen via exact-finance-sync, cache in eigen tabellen.
-- Netto groei (alleen aantallen) voor dashboard en live-scherm, een bron: tel_netto_groei.

CREATE TABLE public.exact_finance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestart_op timestamptz NOT NULL DEFAULT now(),
  klaar_op timestamptz,
  status text NOT NULL DEFAULT 'bezig' CHECK (status IN ('bezig','ok','deels','fout')),
  bron text NOT NULL DEFAULT 'handmatig' CHECK (bron IN ('cron','handmatig')),
  gestart_door uuid,
  vanaf date,
  calls integer NOT NULL DEFAULT 0,
  endpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
  aantallen jsonb NOT NULL DEFAULT '{}'::jsonb,
  fouten jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.exact_finance_runs TO authenticated;
GRANT ALL ON public.exact_finance_runs TO service_role;
ALTER TABLE public.exact_finance_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisor leest exact_finance_runs" ON public.exact_finance_runs FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.exact_facturen_cache (
  exact_id text PRIMARY KEY,
  factuurnummer text,
  account_id text,
  account_code text,
  account_naam text,
  bedrag numeric,
  factuurdatum date,
  vervaldatum date,
  soort text NOT NULL DEFAULT 'factuur' CHECK (soort IN ('factuur','creditnota')),
  exact_type integer,
  exact_status integer,
  omschrijving text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  opgehaald_op timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES public.exact_finance_runs(id)
);
CREATE INDEX exact_facturen_cache_nr ON public.exact_facturen_cache (factuurnummer);
CREATE INDEX exact_facturen_cache_datum ON public.exact_facturen_cache (factuurdatum);
GRANT SELECT ON public.exact_facturen_cache TO authenticated;
GRANT ALL ON public.exact_facturen_cache TO service_role;
ALTER TABLE public.exact_facturen_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisor leest exact_facturen_cache" ON public.exact_facturen_cache FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.exact_open_posten_cache (
  exact_id text PRIMARY KEY,
  factuurnummer text,
  account_id text,
  account_code text,
  account_naam text,
  bedrag numeric,
  factuurdatum date,
  vervaldatum date,
  omschrijving text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  opgehaald_op timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES public.exact_finance_runs(id)
);
CREATE INDEX exact_open_posten_cache_nr ON public.exact_open_posten_cache (factuurnummer);
CREATE INDEX exact_open_posten_cache_run ON public.exact_open_posten_cache (sync_run_id);
GRANT SELECT ON public.exact_open_posten_cache TO authenticated;
GRANT ALL ON public.exact_open_posten_cache TO service_role;
ALTER TABLE public.exact_open_posten_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisor leest exact_open_posten_cache" ON public.exact_open_posten_cache FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.exact_betalingen_cache (
  exact_id text PRIMARY KEY,
  factuurnummer text,
  account_id text,
  account_code text,
  bedrag numeric,
  factuurdatum date,
  vervaldatum date,
  exact_status integer,
  volledig_betaald boolean,
  laatste_betaling date,
  is_terugboeking boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  opgehaald_op timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid REFERENCES public.exact_finance_runs(id)
);
CREATE INDEX exact_betalingen_cache_nr ON public.exact_betalingen_cache (factuurnummer);
GRANT SELECT ON public.exact_betalingen_cache TO authenticated;
GRANT ALL ON public.exact_betalingen_cache TO service_role;
ALTER TABLE public.exact_betalingen_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supervisor leest exact_betalingen_cache" ON public.exact_betalingen_cache FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

-- Laatste run waarin de open posten volledig zijn opgehaald: alleen die rijen tellen als 'nu open'.
CREATE OR REPLACE FUNCTION public.finance_open_run()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT id FROM public.exact_finance_runs WHERE coalesce((endpoints->'open_posten'->>'volledig')::boolean, false)
   ORDER BY gestart_op DESC LIMIT 1
$f$;
REVOKE ALL ON FUNCTION public.finance_open_run() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_open_run() TO authenticated, service_role;

-- Exact-relatie naar klant: eerst exact_account_id, dan relatiecode (genormaliseerd).
CREATE OR REPLACE FUNCTION public.finance_klant(_account_id text, _account_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT coalesce(
    (SELECT o.id FROM public.ondernemingen o WHERE _account_id IS NOT NULL AND lower(o.exact_account_id) = lower(_account_id) LIMIT 1),
    (SELECT o.id FROM public.ondernemingen o WHERE nullif(public.exact_code_norm(_account_code),'') IS NOT NULL
        AND public.exact_code_norm(o.exact_relatie_code) = public.exact_code_norm(_account_code) LIMIT 1))
$f$;
REVOKE ALL ON FUNCTION public.finance_klant(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_klant(text,text) TO authenticated, service_role;

-- Overzicht per maand en klant. Betaald = factuurbedrag min wat in de laatste volledige open-postenrun nog open staat.
CREATE OR REPLACE FUNCTION public.finance_overzicht(_van date, _tot date)
RETURNS TABLE(maand date, onderneming_id uuid, klant text, gefactureerd numeric, betaald numeric, openstaand numeric, gecrediteerd numeric,
              incasso_mislukt integer, incasso_mislukt_bedrag numeric, gestopt integer, geroyeerd integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_run uuid := public.finance_open_run();
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH f AS (
    SELECT c.*, public.finance_klant(c.account_id, c.account_code) ond,
           (SELECT sum(p.bedrag) FROM public.exact_open_posten_cache p WHERE p.sync_run_id = v_run AND p.factuurnummer = c.factuurnummer) open_nu
      FROM public.exact_facturen_cache c
     WHERE c.factuurdatum BETWEEN _van AND _tot AND coalesce(c.exact_status, 50) = 50
  ), fm AS (
    SELECT date_trunc('month', f.factuurdatum)::date m, f.ond,
           sum(f.bedrag) FILTER (WHERE f.soort = 'factuur') gef,
           sum(greatest(f.bedrag - coalesce(f.open_nu, 0), 0)) FILTER (WHERE f.soort = 'factuur') bet,
           sum(coalesce(f.open_nu, 0)) FILTER (WHERE f.soort = 'factuur') opn,
           sum(-f.bedrag) FILTER (WHERE f.soort = 'creditnota') cred
      FROM f GROUP BY 1, 2
  ), im AS (
    SELECT date_trunc('month', m.mislukt_op)::date m, m.onderneming_id ond, count(*)::int n, sum(m.bedrag) b,
           count(*) FILTER (WHERE m.status = 'geroyeerd')::int ger
      FROM public.incasso_mislukt m WHERE NOT m.is_test AND m.mislukt_op BETWEEN _van AND _tot GROUP BY 1, 2
  ), gs AS (
    SELECT date_trunc('month', x.d)::date m, x.ond, count(*)::int n FROM (
      SELECT public.contract_opzegging(k.id) d, k.onderneming_id ond FROM public.klant_contracten k WHERE NOT k.is_test) x
     WHERE x.d BETWEEN _van AND _tot GROUP BY 1, 2
  ), sl AS (SELECT fm.m, fm.ond FROM fm UNION SELECT im.m, im.ond FROM im UNION SELECT gs.m, gs.ond FROM gs)
  SELECT sl.m, sl.ond, o.naam,
         round(coalesce(fm.gef, 0), 2), round(coalesce(fm.bet, 0), 2), round(coalesce(fm.opn, 0), 2), round(coalesce(fm.cred, 0), 2),
         coalesce(im.n, 0), round(coalesce(im.b, 0), 2), coalesce(gs.n, 0), coalesce(im.ger, 0)
    FROM sl LEFT JOIN fm ON fm.m = sl.m AND fm.ond IS NOT DISTINCT FROM sl.ond
    LEFT JOIN im ON im.m = sl.m AND im.ond IS NOT DISTINCT FROM sl.ond
    LEFT JOIN gs ON gs.m = sl.m AND gs.ond IS NOT DISTINCT FROM sl.ond
    LEFT JOIN public.ondernemingen o ON o.id = sl.ond
   WHERE NOT coalesce(o.is_test, false)
   ORDER BY sl.m DESC, o.naam NULLS LAST;
END $f$;
REVOKE ALL ON FUNCTION public.finance_overzicht(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_overzicht(date,date) TO authenticated, service_role;

-- Sluitende aansluiting planning <-> Exact <-> betalingen. Een bron voor admin en agents.
-- Planner factureert vanaf 13-10-2026 (facturatiegrens); daarvoor factureerde het oude systeem, dus vergelijkingen met de planning starten op die datum.
CREATE OR REPLACE FUNCTION public.finance_aansluiting(_van date, _tot date)
RETURNS TABLE(soort text, label text, aantal integer, rijen jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_run uuid := public.finance_open_run(); v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
        v_pvan date := greatest(_van, date '2026-10-13');
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH pl AS (
    SELECT p.*, k.onderneming_id ond FROM public.factuur_planning p JOIN public.klant_contracten k ON k.id = p.klant_contract_id
     WHERE NOT p.is_test AND p.status = 'verwerkt' AND p.vervangen_door IS NULL AND p.exact_verwijderd_op IS NULL
       AND coalesce(p.invoice_date, p.periode_start) BETWEEN v_pvan AND _tot
  ), plf AS (
    SELECT coalesce(pl.exact_invoice_id, pl.exact_invoice_number) sleutel, min(pl.exact_invoice_id) inv_id, min(pl.exact_invoice_number) inv_nr,
           min(pl.ond::text)::uuid ond, sum(pl.bedrag) bedrag, min(coalesce(pl.invoice_date, pl.periode_start)) datum
      FROM pl GROUP BY 1
  ), ex AS (
    SELECT c.*, public.finance_klant(c.account_id, c.account_code) ond FROM public.exact_facturen_cache c
     WHERE c.factuurdatum BETWEEN _van AND _tot AND coalesce(c.exact_status, 50) <> 5
  ), kand AS (
    SELECT * FROM public.facturatie_kandidaten(v_pvan, least(_tot, v_vandaag)) fk
     WHERE fk.blokkade IS NULL AND fk.bestaande_planning_status IS NULL AND fk.periode_start <= v_vandaag
  ), r AS (
    -- 1. in planning maar niet in Exact (of volgens de planner had gefactureerd moeten zijn)
    SELECT 'planning_niet_in_exact' s, plf.ond, jsonb_build_object('factuurnummer', plf.inv_nr, 'datum', plf.datum, 'bedrag', plf.bedrag, 'reden', 'factuur uit planning niet gevonden in Exact') d
      FROM plf WHERE NOT EXISTS (SELECT 1 FROM public.exact_facturen_cache c WHERE c.exact_id = plf.inv_id OR (plf.inv_nr IS NOT NULL AND c.factuurnummer = plf.inv_nr))
    UNION ALL
    SELECT 'planning_niet_in_exact', kand.onderneming_id, jsonb_build_object('periode_start', kand.periode_start, 'bedrag', kand.bedrag, 'product', kand.product, 'reden', 'volgens planner te factureren, nog geen factuur')
      FROM kand
    UNION ALL
    -- 2. in Exact maar niet in planning (klant met contract)
    SELECT 'exact_niet_in_planning', ex.ond, jsonb_build_object('factuurnummer', ex.factuurnummer, 'datum', ex.factuurdatum, 'bedrag', ex.bedrag)
      FROM ex WHERE ex.soort = 'factuur' AND ex.factuurdatum >= v_pvan AND ex.ond IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = ex.ond AND NOT k.is_test)
       AND NOT EXISTS (SELECT 1 FROM public.factuur_planning p WHERE p.exact_invoice_id = ex.exact_id OR (ex.factuurnummer IS NOT NULL AND p.exact_invoice_number = ex.factuurnummer))
    UNION ALL
    -- 3. bedrag planning wijkt af van Exact
    SELECT 'bedrag_afwijking', plf.ond, jsonb_build_object('factuurnummer', c.factuurnummer, 'planning', round(plf.bedrag, 2), 'exact', round(c.bedrag, 2))
      FROM plf JOIN public.exact_facturen_cache c ON c.exact_id = plf.inv_id OR (plf.inv_nr IS NOT NULL AND c.factuurnummer = plf.inv_nr)
     WHERE abs(coalesce(c.bedrag, 0) - coalesce(plf.bedrag, 0)) > 0.01
    UNION ALL
    -- 4. betaald volgens Exact-betalingen, maar nog als open post zichtbaar (niet afgeletterd)
    SELECT 'betaald_niet_afgeletterd', public.finance_klant(b.account_id, b.account_code), jsonb_build_object('factuurnummer', b.factuurnummer, 'laatste_betaling', b.laatste_betaling)
      FROM public.exact_betalingen_cache b
     WHERE b.volledig_betaald IS TRUE AND b.factuurdatum BETWEEN _van AND _tot
       AND EXISTS (SELECT 1 FROM public.exact_open_posten_cache p WHERE p.sync_run_id = v_run AND p.factuurnummer = b.factuurnummer AND p.bedrag > 0)
    UNION ALL
    -- 5. vervallen en open
    SELECT 'vervallen_open', public.finance_klant(p.account_id, p.account_code), jsonb_build_object('factuurnummer', p.factuurnummer, 'vervaldatum', p.vervaldatum, 'bedrag', p.bedrag)
      FROM public.exact_open_posten_cache p
     WHERE p.sync_run_id = v_run AND p.bedrag > 0 AND p.vervaldatum < v_vandaag AND coalesce(p.factuurdatum, p.vervaldatum) BETWEEN _van AND _tot
    UNION ALL
    -- 6. creditnota zonder bijbehorende factuur
    SELECT 'creditnota_zonder_factuur', ex.ond, jsonb_build_object('factuurnummer', ex.factuurnummer, 'datum', ex.factuurdatum, 'bedrag', ex.bedrag, 'origineel', cp.origineel_factuurnummer)
      FROM ex LEFT JOIN public.factuur_credit_planning cp ON cp.exact_invoice_id = ex.exact_id
     WHERE ex.soort = 'creditnota' AND CASE
       WHEN cp.origineel_factuurnummer IS NOT NULL THEN NOT EXISTS (SELECT 1 FROM public.exact_facturen_cache c WHERE c.factuurnummer = cp.origineel_factuurnummer AND c.soort = 'factuur')
       ELSE NOT EXISTS (SELECT 1 FROM public.exact_facturen_cache c WHERE c.soort = 'factuur' AND c.factuurdatum <= ex.factuurdatum
              AND (c.account_id = ex.account_id OR public.exact_code_norm(c.account_code) = public.exact_code_norm(ex.account_code))) END
    UNION ALL
    -- 7. Exact-relatie niet gekoppeld aan een klant
    SELECT 'relatie_niet_gekoppeld', NULL::uuid, jsonb_build_object('relatiecode', public.exact_code_norm(x.account_code), 'aantal_posten', count(*))
      FROM (SELECT account_id, account_code FROM ex UNION ALL SELECT account_id, account_code FROM public.exact_open_posten_cache WHERE sync_run_id = v_run) x
     WHERE public.finance_klant(x.account_id, x.account_code) IS NULL
     GROUP BY public.exact_code_norm(x.account_code)
  ), soorten(s, l, nr) AS (VALUES
    ('planning_niet_in_exact','In planning maar niet in Exact',1), ('exact_niet_in_planning','In Exact maar niet in planning',2),
    ('bedrag_afwijking','Bedrag planning wijkt af van Exact',3), ('betaald_niet_afgeletterd','Betaald maar niet afgeletterd',4),
    ('vervallen_open','Vervallen en open',5), ('creditnota_zonder_factuur','Creditnota zonder bijbehorende factuur',6),
    ('relatie_niet_gekoppeld','Exact-relatie niet gekoppeld aan een klant',7))
  SELECT so.s, so.l, (SELECT count(*)::int FROM r JOIN public.ondernemingen o0 ON o0.id = r.ond WHERE r.s = so.s AND NOT coalesce(o0.is_test,false))
                      + (SELECT count(*)::int FROM r WHERE r.s = so.s AND r.ond IS NULL),
         coalesce((SELECT jsonb_agg(r.d || jsonb_build_object('onderneming_id', r.ond, 'klant', o.naam)) FROM (SELECT * FROM r WHERE r.s = so.s LIMIT 500) r
                    LEFT JOIN public.ondernemingen o ON o.id = r.ond WHERE NOT coalesce(o.is_test,false)), '[]'::jsonb)
    FROM soorten so ORDER BY so.nr;
END $f$;
REVOKE ALL ON FUNCTION public.finance_aansluiting(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_aansluiting(date,date) TO authenticated, service_role;

-- Voorstellen 'Mogelijk incasso mislukt': vervallen open posten van bekende niet-testklanten zonder open geval. Alleen tonen.
CREATE OR REPLACE FUNCTION public.finance_incasso_voorstellen()
RETURNS TABLE(onderneming_id uuid, klant text, factuurnummer text, bedrag numeric, factuurdatum date, vervaldatum date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_run uuid := public.finance_open_run(); v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT o.id, o.naam, p.factuurnummer, p.bedrag, p.factuurdatum, p.vervaldatum
    FROM public.exact_open_posten_cache p JOIN public.ondernemingen o ON o.id = public.finance_klant(p.account_id, p.account_code)
   WHERE p.sync_run_id = v_run AND p.bedrag > 0 AND p.vervaldatum < v_vandaag AND NOT coalesce(o.is_test,false) AND p.factuurnummer IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.incasso_mislukt m WHERE m.onderneming_id = o.id AND m.factuurnummer = p.factuurnummer AND m.status IN ('open','royement_voorgesteld'))
   ORDER BY p.vervaldatum, o.naam;
END $f$;
REVOKE ALL ON FUNCTION public.finance_incasso_voorstellen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_incasso_voorstellen() TO authenticated, service_role;

-- Netto groei: alleen aantallen, nooit bedragen of namen.
-- Keuze contractdefinitie: klant_contracten met product bav_avb of cyber_clear (de verzekeringen). tel_contracten telt ook
-- lidmaatschappen mee; die horen niet bij instroom of opzegpercentage. Instroom = begin_datum in de week (ongeacht latere status,
-- behalve 'vervangen': een vervangen contract is geen nieuwe klant). Beeindiging = echte opzegging via contract_opzegging (opzegdatum
-- in de week) plus geroyeerd (incasso_mislukt.geroyeerd_op). Circle8-opzeggingen (A10, koppeling_methode circle8_collectief) apart, niet als klant.
CREATE OR REPLACE FUNCTION public.tel_netto_groei(_vanaf date DEFAULT date '2026-10-06', _toon_test boolean DEFAULT false)
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

-- Een bron (A6): dashboard_tellers en scherm_data gebruiken tel_netto_groei. Rest van beide functies blijft byte-gelijk.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.dashboard_tellers(boolean)'::regprocedure);
  IF position('tel_netto_groei' IN d) = 0 THEN
    d := replace(d, '''toon_test'', _toon_test', '''toon_test'', _toon_test, ''netto_groei'', public.tel_netto_groei(date ''2026-10-06'', _toon_test)');
    IF position('tel_netto_groei' IN d) = 0 THEN RAISE EXCEPTION 'dashboard_tellers: invoegpunt niet gevonden'; END IF;
    EXECUTE d;
  END IF;
  d := pg_get_functiondef('public.scherm_data()'::regprocedure);
  IF position('tel_netto_groei' IN d) = 0 THEN
    d := replace(d, E'  RETURN res;\nEND', E'  res := res || jsonb_build_object(''netto_groei'', public.tel_netto_groei(date ''2026-10-06'', false));\n  RETURN res;\nEND');
    IF position('tel_netto_groei' IN d) = 0 THEN RAISE EXCEPTION 'scherm_data: invoegpunt niet gevonden'; END IF;
    EXECUTE d;
  END IF;
END $do$;
