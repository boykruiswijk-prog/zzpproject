REVOKE ALL ON public.aanvraag_concepten FROM anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.aanvraag_concepten FROM authenticated;