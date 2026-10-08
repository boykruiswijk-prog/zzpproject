CREATE OR REPLACE FUNCTION public.claim_article_image_worker(p_lease uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 INSERT INTO public.article_image_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE public.article_image_worker SET lease_id=p_lease, lease_until=now()+interval '4 minutes' WHERE id AND (lease_until IS NULL OR lease_until<now());
 RETURN FOUND;
END; $$;