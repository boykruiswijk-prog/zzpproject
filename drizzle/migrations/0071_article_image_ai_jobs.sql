CREATE TABLE public.article_image_jobs (article_id uuid PRIMARY KEY REFERENCES public.articles(id), status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, image_url text, error text);
GRANT ALL ON public.article_image_jobs TO service_role;
GRANT SELECT ON public.article_image_jobs TO authenticated;
ALTER TABLE public.article_image_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_image_jobs_team_read ON public.article_image_jobs FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));
CREATE TABLE public.article_image_worker (id boolean PRIMARY KEY DEFAULT true CHECK (id), lease_id uuid, lease_until timestamptz, paused_reason text);
GRANT ALL ON public.article_image_worker TO service_role;
GRANT SELECT ON public.article_image_worker TO authenticated;
ALTER TABLE public.article_image_worker ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_image_worker_team_read ON public.article_image_worker FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.claim_article_image_worker(p_lease uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.article_image_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE public.article_image_worker SET lease_id=p_lease, lease_until=now()+interval '10 minutes' WHERE id AND paused_reason IS NULL AND (lease_until IS NULL OR lease_until<now());
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.claim_article_image_worker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_article_image_worker(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.artikel_afbeelding_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 IF NEW.is_published IS TRUE AND NEW.image_url IS NULL THEN
  INSERT INTO public.article_image_jobs(article_id) VALUES(NEW.id) ON CONFLICT (article_id) DO UPDATE SET status='pending', requested_at=now() WHERE article_image_jobs.status <> 'running';
  PERFORM net.http_post(url := 'https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/artikel-afbeelding', headers := jsonb_build_object('Content-Type','application/json'), body := '{}'::jsonb);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.artikel_afbeelding_wekken() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_afbeelding_wekken() TO service_role;