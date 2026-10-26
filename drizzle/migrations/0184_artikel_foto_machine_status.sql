CREATE OR REPLACE FUNCTION public.artikel_foto_status(p_slug text) RETURNS TABLE(status text,reden text,image_url text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (session_user IN ('postgres','service_role','supabase_read_only_user') OR auth.role()='service_role' OR (public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2')) THEN RAISE EXCEPTION 'Alleen beheer met tweestapslogin'; END IF;
 IF p_slug IS NULL OR length(p_slug)>200 OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'Ongeldige slug'; END IF;
 RETURN QUERY SELECT CASE WHEN f.id IS NOT NULL THEN 'klaar' WHEN j.status='geweigerd' THEN 'geweigerd' ELSE 'wacht' END,CASE WHEN f.id IS NOT NULL THEN NULL ELSE j.reden END,a.image_url FROM public.articles a LEFT JOIN public.artikel_fotos f ON f.article_id=a.id AND f.image_url=a.image_url LEFT JOIN public.artikel_foto_jobs j ON j.article_id=a.id AND j.bron_url=a.foto_bron_url WHERE a.slug=p_slug;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_status(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artikel_foto_status(text) TO service_role,authenticated,supabase_read_only_user;