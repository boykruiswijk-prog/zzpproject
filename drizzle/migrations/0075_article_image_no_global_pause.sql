ALTER TABLE public.article_image_worker ADD COLUMN IF NOT EXISTS ai_melding text, ADD COLUMN IF NOT EXISTS ai_melding_op timestamptz;
COMMENT ON COLUMN public.article_image_worker.paused_reason IS 'DEPRECATED: AI-fouten pauzeren de wachtrij niet meer; zie ai_melding';
CREATE OR REPLACE FUNCTION public.claim_article_image_worker(p_lease uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 INSERT INTO public.article_image_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE public.article_image_worker SET lease_id=p_lease, lease_until=now()+interval '10 minutes' WHERE id AND (lease_until IS NULL OR lease_until<now());
 RETURN FOUND;
END; $$;
CREATE OR REPLACE FUNCTION public.get_artikelbeeld_melding()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE WHEN public.is_supervisor_or_admin(auth.uid()) THEN (SELECT ai_melding FROM public.article_image_worker WHERE id AND ai_melding_op > now() - interval '7 days') END $$;
REVOKE ALL ON FUNCTION public.get_artikelbeeld_melding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_artikelbeeld_melding() TO authenticated;
UPDATE public.article_image_worker SET paused_reason = NULL WHERE id;