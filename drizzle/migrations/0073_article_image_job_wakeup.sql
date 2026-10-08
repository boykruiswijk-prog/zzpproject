CREATE OR REPLACE FUNCTION public.wake_article_image_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_token uuid; BEGIN
 IF NEW.status='pending' THEN
 INSERT INTO public.article_image_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT wake_token INTO v_token FROM public.article_image_worker WHERE id;
 PERFORM net.http_post(url:='https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/artikel-afbeelding',headers:=jsonb_build_object('Content-Type','application/json','x-article-wake-token',v_token::text),body:='{}'::jsonb);
 END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.wake_article_image_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wake_article_image_job() TO service_role;
CREATE TRIGGER article_image_job_wakeup AFTER INSERT OR UPDATE OF requested_at ON public.article_image_jobs FOR EACH ROW EXECUTE FUNCTION public.wake_article_image_job();
CREATE OR REPLACE FUNCTION public.artikel_afbeelding_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.is_published IS TRUE AND NEW.image_url IS NULL THEN
 INSERT INTO public.article_image_jobs(article_id) VALUES(NEW.id) ON CONFLICT(article_id) DO UPDATE SET status='pending',requested_at=now() WHERE article_image_jobs.status <> 'running';
 END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.artikel_afbeelding_wekken() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_afbeelding_wekken() TO service_role;