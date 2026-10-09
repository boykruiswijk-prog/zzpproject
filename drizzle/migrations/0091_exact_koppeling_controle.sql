CREATE OR REPLACE FUNCTION public.exact_koppeling_controle()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH k AS (
    SELECT o.id, o.naam, o.exact_relatie_code, o.exact_account_id::text AS acc, s.naam AS exact_naam,
      extensions.similarity(
        regexp_replace(lower(o.naam), '\m(b\.?v\.?|holding|v\.o\.f\.?|vof)\M|[^a-z0-9 ]', '', 'g'),
        regexp_replace(lower(coalesce(s.naam,'')), '\m(b\.?v\.?|holding|v\.o\.f\.?|vof)\M|[^a-z0-9 ]', '', 'g')) AS sim
    FROM ondernemingen o
    LEFT JOIN exact_accounts_spiegel s ON s.id::text = o.exact_account_id::text
    WHERE o.exact_account_id IS NOT NULL AND coalesce(o.is_test,false) = false
  ), d AS (
    SELECT acc, min(exact_naam) AS exact_naam, jsonb_agg(jsonb_build_object('id',id,'naam',naam)) AS ond
    FROM k GROUP BY acc HAVING count(*) > 1
  )
  SELECT jsonb_build_object(
    'test_relatie', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'naam',naam,'code',trim(exact_relatie_code),'exact_naam',exact_naam))
       FROM k WHERE exact_naam ~ '^TEST\M'
          OR acc IN (SELECT exact_account_id::text FROM leads WHERE is_test AND exact_account_id IS NOT NULL)), '[]'::jsonb),
    'dubbel_account', coalesce((SELECT jsonb_agg(jsonb_build_object('account',acc,'exact_naam',exact_naam,'ondernemingen',ond)) FROM d), '[]'::jsonb),
    'naam_wijkt_af', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'naam',naam,'code',trim(exact_relatie_code),'exact_naam',exact_naam,'gelijkenis',round(sim::numeric,2)))
       FROM k WHERE exact_naam IS NOT NULL AND sim < 0.3), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.exact_koppeling_controle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exact_koppeling_controle() TO service_role;