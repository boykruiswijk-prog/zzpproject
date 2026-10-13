CREATE TABLE public.klant_mandaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  relatiecode text NOT NULL,
  iban text NOT NULL,
  voorkeur_iban text,
  kenmerk text,
  ondertekend_op date,
  vervaldatum date,
  eenmalig boolean NOT NULL DEFAULT false,
  bron text NOT NULL,
  in_exact boolean,
  exact_kenmerk text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT klant_mandaten_uniek UNIQUE (onderneming_id, kenmerk, bron)
);
CREATE INDEX klant_mandaten_relatiecode_idx ON public.klant_mandaten (relatiecode);
CREATE INDEX klant_mandaten_onderneming_idx ON public.klant_mandaten (onderneming_id);
REVOKE ALL ON public.klant_mandaten FROM anon, authenticated;
GRANT SELECT ON public.klant_mandaten TO authenticated;
GRANT ALL ON public.klant_mandaten TO service_role;
ALTER TABLE public.klant_mandaten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest machtigingen" ON public.klant_mandaten FOR SELECT TO authenticated
USING ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2');

CREATE OR REPLACE VIEW public.klant_mandaat_v WITH (security_invoker = true) AS
SELECT DISTINCT ON (relatiecode) relatiecode, iban, kenmerk, ondertekend_op, status, vervaldatum, bron, in_exact
FROM (
  SELECT relatiecode, iban, kenmerk, ondertekend_op, status, NULL::date AS vervaldatum,
         'exact_mandaat_import'::text AS bron,
         (status IN ('bijgewerkt','overgeslagen_bestaat_al')) AS in_exact, created_at
  FROM public.exact_mandaat_import
  UNION ALL
  SELECT relatiecode, iban, kenmerk, ondertekend_op,
         CASE WHEN in_exact THEN 'in_exact' ELSE 'afas' END, vervaldatum, bron, in_exact, created_at
  FROM public.klant_mandaten
) m
ORDER BY relatiecode, ondertekend_op DESC NULLS LAST, created_at DESC;
REVOKE ALL ON public.klant_mandaat_v FROM anon;

CREATE OR REPLACE FUNCTION public.mandaat_iban_naar_onderneming()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n_bijgewerkt int := 0; n_overgeslagen int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (k.onderneming_id) k.onderneming_id, k.iban, k.id AS mandaat_id, k.bron
    FROM public.klant_mandaten k
    ORDER BY k.onderneming_id, k.ondertekend_op DESC NULLS LAST, k.created_at DESC
  LOOP
    UPDATE public.ondernemingen SET iban = upper(replace(r.iban,' ',''))
     WHERE id = r.onderneming_id AND coalesce(trim(iban),'') = '';
    IF FOUND THEN
      n_bijgewerkt := n_bijgewerkt + 1;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door_rol, details)
      VALUES ('ondernemingen', r.onderneming_id, 'iban_uit_machtiging', 'iban', NULL,
        left(upper(replace(r.iban,' ','')),2) || '**' || right(r.iban,4), 'service_role',
        jsonb_build_object('mandaat_id', r.mandaat_id, 'bron', r.bron));
    ELSE n_overgeslagen := n_overgeslagen + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('bijgewerkt', n_bijgewerkt, 'overgeslagen_al_gevuld', n_overgeslagen);
END $$;
REVOKE ALL ON FUNCTION public.mandaat_iban_naar_onderneming() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mandaat_iban_naar_onderneming() TO service_role;

CREATE OR REPLACE FUNCTION public.machtigingen_nakijken()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT ((public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang'; END IF;
  WITH o AS (
    SELECT id, naam, exact_relatie_code FROM public.ondernemingen
    WHERE coalesce(is_test,false) = false AND coalesce(status,'') NOT IN ('beeindigd','vervangen')
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
REVOKE ALL ON FUNCTION public.machtigingen_nakijken() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.machtigingen_nakijken() TO authenticated;