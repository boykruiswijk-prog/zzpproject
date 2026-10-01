-- Fase 2: de site als factuurplanner. Hoofdschakelaar standaard UIT.
CREATE TABLE public.facturatie_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  facturatie_actief boolean NOT NULL DEFAULT false,
  verwerk_termijn_werkdagen integer NOT NULL DEFAULT 5,
  sleutel_veld text NOT NULL DEFAULT 'Remarks' CHECK (sleutel_veld IN ('Remarks','YourRef')),
  bijgewerkt_door uuid,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.facturatie_config (id) VALUES (1);
GRANT SELECT ON public.facturatie_config TO authenticated;
GRANT ALL ON public.facturatie_config TO service_role;
ALTER TABLE public.facturatie_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest facturatieconfig" ON public.facturatie_config FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.factuur_artikel_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itemcode_patroon text NOT NULL UNIQUE,
  product text NOT NULL,
  exact_item_id text,
  exact_item_code text,
  gl_code text,
  bevestigd boolean NOT NULL DEFAULT false,
  blokkade_reden text,
  notitie text,
  bevestigd_door uuid,
  bevestigd_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.factuur_artikel_mapping TO authenticated;
GRANT ALL ON public.factuur_artikel_mapping TO service_role;
ALTER TABLE public.factuur_artikel_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest artikelmapping" ON public.factuur_artikel_mapping FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));
CREATE TRIGGER trg_factuur_artikel_mapping_updated BEFORE UPDATE ON public.factuur_artikel_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.factuur_planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klant_contract_id uuid NOT NULL REFERENCES public.klant_contracten(id),
  periode_start date NOT NULL,
  periode_eind date NOT NULL,
  aantal numeric NOT NULL,
  bedrag_per_periode numeric NOT NULL,
  bedrag numeric NOT NULL,
  exact_account_id text NOT NULL,
  exact_item_id text NOT NULL,
  gl_code text,
  planningssleutel text NOT NULL UNIQUE CHECK (planningssleutel ~ '^ZPF-[0-9A-F]{8}$'),
  status text NOT NULL DEFAULT 'geclaimd' CHECK (status IN ('geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout','vervangen')),
  exact_invoice_id text,
  exact_invoice_number text,
  exact_status smallint,
  invoice_date date,
  foutmelding text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  concept_op timestamptz,
  verwerkt_op timestamptz,
  laatst_gecontroleerd_op timestamptz,
  vervangen_door uuid REFERENCES public.factuur_planning(id),
  is_test boolean NOT NULL DEFAULT false
);
-- Eén actieve planning per (contractregel, periode_start); 'vervangen' telt niet mee.
CREATE UNIQUE INDEX factuur_planning_uniek_actief ON public.factuur_planning (klant_contract_id, periode_start)
  WHERE status <> 'vervangen';
CREATE INDEX factuur_planning_status_idx ON public.factuur_planning (status);
GRANT SELECT ON public.factuur_planning TO authenticated;
GRANT ALL ON public.factuur_planning TO service_role;
ALTER TABLE public.factuur_planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest factuurplanning" ON public.factuur_planning FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.factuur_planning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id uuid REFERENCES public.factuur_planning(id),
  klant_contract_id uuid,
  actie text NOT NULL,
  oud jsonb,
  nieuw jsonb,
  uitgevoerd_door uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.factuur_planning_log TO authenticated;
GRANT ALL ON public.factuur_planning_log TO service_role;
ALTER TABLE public.factuur_planning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest planninglog" ON public.factuur_planning_log FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.factuur_planner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestart_op timestamptz NOT NULL DEFAULT now(),
  modus text NOT NULL CHECK (modus IN ('proef','live')),
  trigger_type text NOT NULL,
  aantal_kandidaten integer NOT NULL DEFAULT 0,
  aantal_geblokkeerd integer NOT NULL DEFAULT 0,
  aantal_aangemaakt integer NOT NULL DEFAULT 0,
  bedrag numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.factuur_planner_runs TO authenticated;
GRANT ALL ON public.factuur_planner_runs TO service_role;
ALTER TABLE public.factuur_planner_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest plannerruns" ON public.factuur_planner_runs FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()));

ALTER TABLE public.ondernemingen
  ADD COLUMN facturatie_blokkade text,
  ADD COLUMN facturatie_blokkade_reden text;

CREATE SEQUENCE IF NOT EXISTS public.klant_contract_site_rij_seq START 1;
GRANT USAGE ON SEQUENCE public.klant_contract_site_rij_seq TO service_role;

COMMENT ON TABLE public.monthly_invoices_log IS 'DEPRECATED: maandcron vervangen door factuur-planner (factuur_planning). Alleen historie.';

-- Pure periode-helpers (spiegel van _shared/factuurPeriode.ts)
CREATE OR REPLACE FUNCTION public.factuur_periode_start(_anker date, _cyclus text, _n integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (_anker + CASE WHEN _cyclus = 'jaar' THEN make_interval(years => _n) ELSE make_interval(months => _n) END)::date
$$;
CREATE OR REPLACE FUNCTION public.factuur_periode_eind(_start date, _cyclus text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ((_start + CASE WHEN _cyclus = 'jaar' THEN interval '1 year' ELSE interval '1 month' END)::date - 1)
$$;

CREATE OR REPLACE FUNCTION public.factuur_mapping_voor(_itemcode text)
RETURNS public.factuur_artikel_mapping LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.* FROM public.factuur_artikel_mapping m
  WHERE upper(trim(_itemcode)) = upper(m.itemcode_patroon)
     OR (m.itemcode_patroon LIKE '%\%%' AND upper(trim(_itemcode)) LIKE upper(m.itemcode_patroon))
  ORDER BY (upper(trim(_itemcode)) = upper(m.itemcode_patroon)) DESC, length(m.itemcode_patroon) DESC
  LIMIT 1
$$;

-- Kandidaten (proefrun en planner): per regel en periode, met blokkadereden.
CREATE OR REPLACE FUNCTION public.facturatie_kandidaten(_van date, _tot date)
RETURNS TABLE(
  klant_contract_id uuid, onderneming_id uuid, relatiecode text, klantnaam text, itemcode text, product text,
  cyclus text, periode_start date, periode_eind date, aantal numeric, bedrag_per_periode numeric, bedrag numeric,
  exact_account_id text, exact_item_id text, gl_code text, achterstallig boolean,
  blokkade text, blokkade_soort text, bestaande_planning_status text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  IF _tot < _van OR _tot - _van > 400 THEN RAISE EXCEPTION 'ongeldig bereik'; END IF;
  RETURN QUERY
  WITH c AS (
    SELECT k.*, o.exact_relatie_code AS rc, coalesce(o.exact_account_naam, o.naam) AS nm, o.exact_account_id AS acc,
           o.exact_koppeling_status AS ks, o.facturatie_blokkade AS ob, o.facturatie_blokkade_reden AS obr,
           (public.factuur_mapping_voor(k.itemcode)).* AS m
    FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
    WHERE k.status IN ('actief','loopt_af') AND NOT k.is_test AND NOT o.is_test AND k.volgende_factuurdatum IS NOT NULL
  ), p AS (
    SELECT c.*, public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n) AS ps
    FROM c, generate_series(0, 500) n
    WHERE public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n) <= _tot
  )
  SELECT p.id, p.onderneming_id, p.rc, p.nm, p.itemcode, p.product, p.cyclus, p.ps,
         public.factuur_periode_eind(p.ps, p.cyclus), p.aantal, p.bedrag_per_periode,
         round(p.bedrag_per_periode * p.aantal, 2), p.acc, (p.m).exact_item_id, (p.m).gl_code,
         p.ps < _van,
         CASE
           WHEN p.ob IS NOT NULL THEN coalesce(p.obr, p.ob)
           WHEN p.acc IS NULL THEN 'geen Exact-koppeling (relatie niet gevonden)'
           WHEN p.eind_datum IS NOT NULL AND p.ps > p.eind_datum THEN 'na einddatum contract'
           WHEN round(p.bedrag_per_periode * p.aantal, 2) <= 0 THEN 'bedrag nul of negatief'
           WHEN (p.m).id IS NULL THEN 'geen artikelmapping (' || p.itemcode || ')'
           WHEN (p.m).blokkade_reden IS NOT NULL THEN (p.m).blokkade_reden
           WHEN (p.m).exact_item_id IS NULL THEN 'artikel ontbreekt in Exact (' || p.itemcode || ')'
           WHEN NOT (p.m).bevestigd THEN 'artikelmapping nog niet bevestigd'
           WHEN fp.status IS NOT NULL THEN 'periode al gepland (' || fp.status || ')'
         END,
         CASE
           WHEN p.ob IS NOT NULL THEN 'conflict'
           WHEN p.acc IS NULL THEN 'relatie'
           WHEN p.eind_datum IS NOT NULL AND p.ps > p.eind_datum THEN 'einddatum'
           WHEN round(p.bedrag_per_periode * p.aantal, 2) <= 0 THEN 'bedrag'
           WHEN (p.m).id IS NULL OR (p.m).blokkade_reden IS NOT NULL OR (p.m).exact_item_id IS NULL THEN 'artikel'
           WHEN NOT (p.m).bevestigd THEN 'mapping'
           WHEN fp.status IS NOT NULL THEN 'bezet'
         END,
         fp.status
  FROM p LEFT JOIN public.factuur_planning fp
    ON fp.klant_contract_id = p.id AND fp.periode_start = p.ps AND fp.status <> 'vervangen'
  WHERE p.ps >= LEAST(_van, p.volgende_factuurdatum) AND (p.ps >= _van OR p.ps < _van)
  ORDER BY p.ps, p.rc;
END $$;
REVOKE ALL ON FUNCTION public.facturatie_kandidaten(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturatie_kandidaten(date, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.factuur_mapping_voor(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.factuur_mapping_voor(text) TO service_role;

-- Startstand: doorrollen t/m 16-10-2026, met preview.
CREATE OR REPLACE FUNCTION public.doorrol_startstand(_preview boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer; nieuw_v date; res jsonb := '[]'::jsonb; cnt integer := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  FOR r IN SELECT k.*, o.exact_relatie_code AS rc, o.naam AS nm FROM public.klant_contracten k
           JOIN public.ondernemingen o ON o.id = k.onderneming_id
           WHERE k.status IN ('actief','loopt_af') AND NOT k.is_test
             AND k.volgende_factuurdatum <= DATE '2026-10-16' ORDER BY k.bron_rij
  LOOP
    n := 0;
    LOOP n := n + 1; nieuw_v := public.factuur_periode_start(r.volgende_factuurdatum, r.cyclus, n);
      EXIT WHEN nieuw_v >= DATE '2026-10-17'; END LOOP;
    cnt := cnt + 1;
    res := res || jsonb_build_object('id', r.id, 'bron_rij', r.bron_rij, 'relatiecode', r.rc, 'naam', r.nm,
      'cyclus', r.cyclus, 'cycli', n, 'oud_gefactureerd_tm', r.gefactureerd_tm, 'oud_volgende', r.volgende_factuurdatum,
      'nieuw_gefactureerd_tm', nieuw_v - 1, 'nieuw_volgende', nieuw_v);
    IF NOT _preview THEN
      UPDATE public.klant_contracten SET gefactureerd_tm = nieuw_v - 1, volgende_factuurdatum = nieuw_v,
        gefactureerd_tm_bron = 'doorrol_20261016' WHERE id = r.id;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
      VALUES ('klant_contracten', r.id, 'doorrol_startstand', 'gefactureerd_tm/volgende_factuurdatum',
        r.gefactureerd_tm::text || ' / ' || r.volgende_factuurdatum::text, (nieuw_v - 1)::text || ' / ' || nieuw_v::text,
        auth.uid(), jsonb_build_object('cycli', n, 'bron_rij', r.bron_rij));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('preview', _preview, 'aantal', cnt, 'regels', res);
END $$;
REVOKE ALL ON FUNCTION public.doorrol_startstand(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doorrol_startstand(boolean) TO authenticated, service_role;

-- Hoofdschakelaar: alleen admin.
CREATE OR REPLACE FUNCTION public.zet_facturatie_actief(_aan boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oud boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'alleen admin'; END IF;
  SELECT facturatie_actief INTO oud FROM public.facturatie_config WHERE id = 1;
  UPDATE public.facturatie_config SET facturatie_actief = _aan, bijgewerkt_door = auth.uid(), bijgewerkt_op = now() WHERE id = 1;
  INSERT INTO public.sensitive_audit_log (target_table, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('facturatie_config', 'hoofdschakelaar', 'facturatie_actief', oud::text, _aan::text, auth.uid(), '{}'::jsonb);
  RETURN _aan;
END $$;
REVOKE ALL ON FUNCTION public.zet_facturatie_actief(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zet_facturatie_actief(boolean) TO authenticated;

-- Opnieuw inplannen na verwijderd/te laat: alleen supervisor/admin, nooit automatisch.
CREATE OR REPLACE FUNCTION public.factuur_opnieuw_inplannen(_planning_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oud public.factuur_planning;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO oud FROM public.factuur_planning WHERE id = _planning_id FOR UPDATE;
  IF oud.id IS NULL OR oud.status NOT IN ('verwijderd_in_exact','te_laat','fout') THEN
    RAISE EXCEPTION 'alleen bij verwijderd, te laat of fout';
  END IF;
  UPDATE public.factuur_planning SET status = 'vervangen' WHERE id = oud.id;
  INSERT INTO public.factuur_planning_log (planning_id, klant_contract_id, actie, oud, nieuw, uitgevoerd_door)
  VALUES (oud.id, oud.klant_contract_id, 'opnieuw_inplannen', jsonb_build_object('status', oud.status),
          jsonb_build_object('status', 'vervangen'), auth.uid());
  RETURN jsonb_build_object('ok', true, 'vrijgegeven_periode', oud.periode_start);
END $$;
REVOKE ALL ON FUNCTION public.factuur_opnieuw_inplannen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.factuur_opnieuw_inplannen(uuid) TO authenticated;

-- Admin mag mapping bevestigen.
CREATE OR REPLACE FUNCTION public.bevestig_artikel_mapping(_id uuid, _bevestigd boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'alleen admin'; END IF;
  UPDATE public.factuur_artikel_mapping SET bevestigd = _bevestigd, bevestigd_door = auth.uid(), bevestigd_op = now()
  WHERE id = _id AND exact_item_id IS NOT NULL AND blokkade_reden IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.bevestig_artikel_mapping(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bevestig_artikel_mapping(uuid, boolean) TO authenticated;

-- De oude maandcron verdwijnt: één factuurroute.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-invoices-cron-daily') THEN
    PERFORM cron.unschedule('monthly-invoices-cron-daily');
  END IF;
END $$;