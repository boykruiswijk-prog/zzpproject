REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.aov_doorverwijzingen FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.aov_doorverwijzingen FROM authenticated;
GRANT INSERT ON public.aov_doorverwijzingen TO anon, authenticated;
GRANT SELECT ON public.aov_doorverwijzingen TO authenticated;