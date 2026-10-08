ALTER TABLE public.article_image_worker ADD COLUMN wake_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE OR REPLACE FUNCTION public.artikel_afbeelding_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_token uuid; BEGIN
 IF NEW.is_published IS TRUE AND NEW.image_url IS NULL THEN
 INSERT INTO public.article_image_jobs(article_id) VALUES(NEW.id) ON CONFLICT(article_id) DO UPDATE SET status='pending',requested_at=now() WHERE article_image_jobs.status <> 'running';
 INSERT INTO public.article_image_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT wake_token INTO v_token FROM public.article_image_worker WHERE id;
 PERFORM net.http_post(url:='https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/artikel-afbeelding',headers:=jsonb_build_object('Content-Type','application/json','x-article-wake-token',v_token::text),body:='{}'::jsonb);
 END IF;
 RETURN NEW;
 END; $$;
REVOKE ALL ON FUNCTION public.artikel_afbeelding_wekken() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_afbeelding_wekken() TO service_role;
REVOKE SELECT ON public.article_image_worker FROM authenticated;