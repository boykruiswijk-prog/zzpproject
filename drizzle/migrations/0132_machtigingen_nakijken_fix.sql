CREATE OR REPLACE FUNCTION public.machtigingen_nakijken()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang'; END IF;
  WITH o AS (
    SELECT id, naam, exact_relatie_code FROM public.ondernemingen od
    WHERE coalesce(od.is_test,false) = false
      AND EXISTS (SELECT 1 FROM public.klant_contracten c WHERE c.onderneming_id = od.id AND c.status IN ('actief','loopt_af','einddatum_controle'))
  ), alle AS (
    SELECT k.onderneming_id, k.kenmerk, k.ondertekend_op, k.vervaldatum, k.in_exact, k.bron FROM public.klant_mandaten k
    UNION ALL
    SELECT o.id, e.kenmerk, e.ondertekend_op, NULL::date, e.status IN ('bijgewerkt','overgeslagen_bestaat_al'), 'exact_mandaat_import'
    FROM public.exact_mandaat_import e JOIN o ON o.exact_relatie_code = e.relatiecode
  )
  SELECT jsonb_build_object(
    'niet_in_exact', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'naam',o.naam,'relatiecode',o.exact_relatie_code) ORDER BY o.naam) FROM o
       WHERE EXISTS (SELECT 1 FROM alle a WHERE a.onderneming_id=o.id AND a.bron <> 'exact_mandaat_import')
         AND NOT EXISTS (SELECT 1 FROM alle a WHERE a.onderneming_id=o.id AND a.in_exact)), '[]'),
    'zonder', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'naam',o.naam,'relatiecode',o.exact_relatie_code) ORDER BY o.naam) FROM o
       WHERE NOT EXISTS (SELECT 1 FROM alle a WHERE a.onderneming_id=o.id)), '[]'),
    'verlopen', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'naam',o.naam,'relatiecode',o.exact_relatie_code,'kenmerk',a.kenmerk,'vervaldatum',a.vervaldatum) ORDER BY a.vervaldatum) FROM o JOIN alle a ON a.onderneming_id=o.id
       WHERE a.vervaldatum < (now() AT TIME ZONE 'Europe/Amsterdam')::date), '[]')
  ) INTO res;
  RETURN res;
END $$;