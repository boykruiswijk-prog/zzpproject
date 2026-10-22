REVOKE ALL ON public.aov_aanmeldingen FROM anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.aov_aanmeldingen FROM authenticated;