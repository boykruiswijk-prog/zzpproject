-- Live-scherm: versheid per AI-agent (laatste agent_run/agent_stap) en tijd van de laatste Scherm-feed per bron.
CREATE OR REPLACE FUNCTION public.scherm_versheid()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'agent_laatst', COALESCE((SELECT jsonb_agg(jsonb_build_object('sleutel', sleutel, 'tijd', tijd))
      FROM (SELECT lower(split_part(split_part(tekst, ':', 1), ' heeft', 1)) AS sleutel, max(created_at) AS tijd
            FROM machine_activiteit
            WHERE actie IN ('agent_run','agent_stap') AND NOT is_test AND created_at > now() - interval '14 days'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 40) x), '[]'::jsonb),
    'snapshot_op', COALESCE((SELECT jsonb_object_agg(bron, op)
      FROM (SELECT bron, max(created_at) AS op FROM marketing_snapshot GROUP BY bron) y), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.scherm_versheid() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_versheid() TO service_role;