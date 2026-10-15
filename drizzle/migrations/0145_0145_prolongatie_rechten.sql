-- Alleen team of service_role mag prolongatiekandidaten lezen.
CREATE OR REPLACE FUNCTION public.prolongatie_kandidaten(_van date, _tot date)
RETURNS TABLE(klant_contract_id uuid, onderneming_id uuid, klantnaam text, product text, itemcode text, bedrag numeric, verlengdatum date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT k.id, k.onderneming_id, o.naam, k.product, k.itemcode, round(k.bedrag_per_periode * k.aantal, 2), k.volgende_factuurdatum
    FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.cyclus = 'jaar' AND k.status IN ('actief','einddatum_controle') AND NOT k.is_test AND NOT coalesce(o.is_test,false)
     AND k.volgende_factuurdatum BETWEEN _van AND _tot AND public.contract_opzegging(k.id) IS NULL
   ORDER BY k.volgende_factuurdatum, o.naam;
END $f$;