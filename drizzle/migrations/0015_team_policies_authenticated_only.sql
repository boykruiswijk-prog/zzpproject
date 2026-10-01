-- Teampolicies die is_team_member/has_role/is_supervisor_or_admin aanroepen gelden alleen voor ingelogde gebruikers.
-- Anon heeft (bewust) geen EXECUTE op die functies; zonder deze beperking faalt elke anonieme lees-query.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname IN ('public','storage') AND 'public' = ANY(roles)
      AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(is_team_member|has_role|is_supervisor_or_admin)'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER POLICY "Articles are publicly readable" ON public.articles TO anon, authenticated;
ALTER POLICY "Article images are publicly accessible" ON storage.objects TO anon, authenticated;