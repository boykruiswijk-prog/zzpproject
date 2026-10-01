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
           public.factuur_mapping_voor(k.itemcode) AS m
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
  ORDER BY p.ps, p.rc;
END $$;