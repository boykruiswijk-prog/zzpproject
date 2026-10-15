ALTER TABLE public.exact_facturen_cache ADD COLUMN IF NOT EXISTS bedrag_excl_btw numeric;
ALTER TABLE public.exact_open_posten_cache ADD COLUMN IF NOT EXISTS entrynummer text;
-- Oude cache: InvoiceNumber 0 is geen factuurnummer.
UPDATE public.exact_open_posten_cache SET entrynummer = coalesce(entrynummer, (raw->>'EntryNumber')::numeric::bigint::text), factuurnummer = NULL WHERE factuurnummer = '0';
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
  ), bekend AS (
    -- Facturen die de activatie (lead-to-exact-activate) maakte: leads.exact_invoice_* en exact_sync_log.
    SELECT lower(l.exact_invoice_id) id, l.exact_invoice_number nr FROM public.leads l
     WHERE l.exact_invoice_id IS NOT NULL OR coalesce(l.exact_invoice_number,'') <> ''
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
    -- 2. in Exact maar niet in planning (klant met contract); activatiefacturen zijn bekend
    SELECT 'exact_niet_in_planning', ex.ond, jsonb_build_object('factuurnummer', ex.factuurnummer, 'datum', ex.factuurdatum, 'bedrag', ex.bedrag)
      FROM ex WHERE ex.soort = 'factuur' AND ex.factuurdatum >= v_pvan AND ex.ond IS NOT NULL AND ex.factuurnummer IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM bekend b WHERE b.id = lower(ex.exact_id) OR (b.nr IS NOT NULL AND b.nr = ex.factuurnummer))
       AND NOT EXISTS (SELECT 1 FROM public.exact_sync_log g WHERE g.status = 'success' AND g.payload::text ILIKE '%' || ex.exact_id || '%')
       AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = ex.ond AND NOT k.is_test)
       AND NOT EXISTS (SELECT 1 FROM public.factuur_planning p WHERE p.exact_invoice_id = ex.exact_id OR (ex.factuurnummer IS NOT NULL AND p.exact_invoice_number = ex.factuurnummer))
    UNION ALL
    -- 2b. concept in Exact (nog geen factuurnummer): apart, geen verschil
    SELECT 'concept_in_exact', ex.ond, jsonb_build_object('datum', ex.factuurdatum, 'bedrag', ex.bedrag, 'omschrijving', ex.omschrijving)
      FROM ex WHERE ex.factuurnummer IS NULL
    UNION ALL
    -- 3. bedrag planning wijkt af van Exact. Planning is exclusief btw; vergelijk met het Exact-bedrag exclusief btw.
    SELECT 'bedrag_afwijking', plf.ond, jsonb_build_object('factuurnummer', c.factuurnummer, 'planning', round(plf.bedrag, 2), 'exact_excl_btw', round(coalesce(c.bedrag_excl_btw, c.bedrag), 2), 'exact_incl_btw', round(c.bedrag, 2))
      FROM plf JOIN public.exact_facturen_cache c ON c.exact_id = plf.inv_id OR (plf.inv_nr IS NOT NULL AND c.factuurnummer = plf.inv_nr)
     WHERE abs(coalesce(c.bedrag_excl_btw, c.bedrag, 0) - coalesce(plf.bedrag, 0)) > 0.01
    UNION ALL
    -- 4. betaald volgens Exact-betalingen, maar nog als open post zichtbaar (niet afgeletterd)
    SELECT 'betaald_niet_afgeletterd', public.finance_klant(b.account_id, b.account_code), jsonb_build_object('factuurnummer', b.factuurnummer, 'laatste_betaling', b.laatste_betaling)
      FROM public.exact_betalingen_cache b
     WHERE b.volledig_betaald IS TRUE AND b.factuurdatum BETWEEN _van AND _tot
       AND EXISTS (SELECT 1 FROM public.exact_open_posten_cache p WHERE p.sync_run_id = v_run AND p.factuurnummer = b.factuurnummer AND p.bedrag > 0)
    UNION ALL
    -- 5. vervallen en open (alleen met echt factuurnummer)
    SELECT 'vervallen_open', public.finance_klant(p.account_id, p.account_code), jsonb_build_object('factuurnummer', p.factuurnummer, 'vervaldatum', p.vervaldatum, 'bedrag', p.bedrag)
      FROM public.exact_open_posten_cache p
     WHERE p.sync_run_id = v_run AND p.bedrag > 0 AND p.vervaldatum < v_vandaag AND p.factuurnummer IS NOT NULL AND p.factuurnummer <> '0' AND coalesce(p.factuurdatum, p.vervaldatum) BETWEEN _van AND _tot
    UNION ALL
    -- 5b. post zonder factuurnummer (bijv. bankboeking, beginbalans, memoriaal): apart, met entrynummer
    SELECT 'post_zonder_factuurnummer', public.finance_klant(p.account_id, p.account_code), jsonb_build_object('entrynummer', p.entrynummer, 'dagboek', p.raw->>'JournalCode', 'datum', p.factuurdatum, 'bedrag', p.bedrag, 'omschrijving', p.omschrijving)
      FROM public.exact_open_posten_cache p WHERE p.sync_run_id = v_run AND (p.factuurnummer IS NULL OR p.factuurnummer = '0')
    UNION ALL
    -- 6. creditnota zonder bijbehorende factuur
    SELECT 'creditnota_zonder_factuur', ex.ond, jsonb_build_object('factuurnummer', ex.factuurnummer, 'datum', ex.factuurdatum, 'bedrag', ex.bedrag, 'origineel', cp.origineel_factuurnummer)
      FROM ex LEFT JOIN public.factuur_credit_planning cp ON cp.exact_invoice_id = ex.exact_id
     WHERE ex.soort = 'creditnota' AND CASE
       WHEN cp.origineel_factuurnummer IS NOT NULL THEN NOT EXISTS (SELECT 1 FROM public.exact_facturen_cache c WHERE c.factuurnummer = cp.origineel_factuurnummer AND c.soort = 'factuur')
       ELSE NOT EXISTS (SELECT 1 FROM public.exact_facturen_cache c WHERE c.soort = 'factuur' AND c.factuurdatum <= ex.factuurdatum
              AND (c.account_id = ex.account_id OR public.exact_code_norm(c.account_code) = public.exact_code_norm(ex.account_code))) END
    UNION ALL
    -- 7. Exact-relatie niet gekoppeld aan een klant (relatiecode via accountspiegel als de code ontbreekt)
    SELECT 'relatie_niet_gekoppeld', NULL::uuid, jsonb_build_object('relatiecode', x.code, 'relatienaam', min(x.naam), 'aantal_posten', count(*))
      FROM (SELECT y.account_id, coalesce(nullif(public.exact_code_norm(y.account_code),''), a.code_norm, public.exact_code_norm(a.code)) code, coalesce(y.naam, a.naam) naam
              FROM (SELECT account_id, account_code, account_naam naam FROM ex UNION ALL SELECT account_id, account_code, account_naam FROM public.exact_open_posten_cache WHERE sync_run_id = v_run) y
              LEFT JOIN public.exact_accounts_spiegel a ON lower(a.id::text) = lower(y.account_id)) x
     WHERE public.finance_klant(x.account_id, x.code) IS NULL
     GROUP BY x.code
  ), soorten(s, l, nr) AS (VALUES
    ('planning_niet_in_exact','In planning maar niet in Exact',1), ('exact_niet_in_planning','In Exact maar niet in planning',2),
    ('bedrag_afwijking','Bedrag planning wijkt af van Exact',3), ('betaald_niet_afgeletterd','Betaald maar niet afgeletterd',4),
    ('vervallen_open','Vervallen en open',5), ('creditnota_zonder_factuur','Creditnota zonder bijbehorende factuur',6),
    ('relatie_niet_gekoppeld','Exact-relatie niet gekoppeld aan een klant',7),
    ('concept_in_exact','Concept in Exact (nog geen factuurnummer, geen verschil)',8),
    ('post_zonder_factuurnummer','Post zonder factuurnummer (bijv. bank of memoriaal, geen verschil)',9))
  SELECT so.s, so.l, (SELECT count(*)::int FROM r JOIN public.ondernemingen o0 ON o0.id = r.ond WHERE r.s = so.s AND NOT coalesce(o0.is_test,false))
                      + (SELECT count(*)::int FROM r WHERE r.s = so.s AND r.ond IS NULL),
         coalesce((SELECT jsonb_agg(r.d || jsonb_build_object('onderneming_id', r.ond, 'klant', o.naam)) FROM (SELECT * FROM r WHERE r.s = so.s LIMIT 500) r
                    LEFT JOIN public.ondernemingen o ON o.id = r.ond WHERE NOT coalesce(o.is_test,false)), '[]'::jsonb)
    FROM soorten so ORDER BY so.nr;
END $f$;
REVOKE ALL ON FUNCTION public.finance_aansluiting(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_aansluiting(date,date) TO authenticated, service_role;

-- Voorstel alleen met echt factuurnummer (nooit 0).
CREATE OR REPLACE FUNCTION public.finance_incasso_voorstellen()
RETURNS TABLE(onderneming_id uuid, klant text, factuurnummer text, bedrag numeric, factuurdatum date, vervaldatum date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_run uuid := public.finance_open_run(); v_vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT o.id, o.naam, p.factuurnummer, p.bedrag, p.factuurdatum, p.vervaldatum
    FROM public.exact_open_posten_cache p JOIN public.ondernemingen o ON o.id = public.finance_klant(p.account_id, p.account_code)
   WHERE p.sync_run_id = v_run AND p.bedrag > 0 AND p.vervaldatum < v_vandaag AND NOT coalesce(o.is_test,false) AND p.factuurnummer IS NOT NULL AND p.factuurnummer <> '0' AND p.factuurnummer ~ '[1-9]'
     AND NOT EXISTS (SELECT 1 FROM public.incasso_mislukt m WHERE m.onderneming_id = o.id AND m.factuurnummer = p.factuurnummer AND m.status IN ('open','royement_voorgesteld'))
   ORDER BY p.vervaldatum, o.naam;
END $f$;
REVOKE ALL ON FUNCTION public.finance_incasso_voorstellen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_incasso_voorstellen() TO authenticated, service_role;