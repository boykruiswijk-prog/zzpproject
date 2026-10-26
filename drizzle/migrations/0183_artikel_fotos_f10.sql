ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS foto_bron_url text, ADD COLUMN IF NOT EXISTS foto_prompt text, ADD COLUMN IF NOT EXISTS foto_alt text, ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE TABLE public.artikel_fotos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid NOT NULL REFERENCES public.articles(id), slug text NOT NULL, bron_url text NOT NULL, bron_host text NOT NULL, storage_pad text NOT NULL UNIQUE, image_url text NOT NULL UNIQUE, sha256 text NOT NULL UNIQUE, bron_sha256 text NOT NULL, phash bit(64) NOT NULL, breedte integer NOT NULL, hoogte integer NOT NULL, prompt text, created_at timestamptz NOT NULL DEFAULT now(), is_test boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.artikel_fotos TO authenticated;
GRANT ALL ON public.artikel_fotos TO service_role;
ALTER TABLE public.artikel_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY artikel_fotos_admin ON public.artikel_fotos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2');
CREATE TABLE public.artikel_foto_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid NOT NULL REFERENCES public.articles(id), bron_url text NOT NULL, bron_host text, status text NOT NULL DEFAULT 'wacht', reden text, lease uuid, lease_tot timestamptz, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(article_id,bron_url));
GRANT SELECT ON public.artikel_foto_jobs TO authenticated;
GRANT ALL ON public.artikel_foto_jobs TO service_role;
ALTER TABLE public.artikel_foto_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY artikel_foto_jobs_admin ON public.artikel_foto_jobs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2');
CREATE TABLE public.artikel_foto_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid REFERENCES public.articles(id), job_id uuid REFERENCES public.artikel_foto_jobs(id), status text NOT NULL, reden text, bron_host text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.artikel_foto_log TO authenticated;
GRANT ALL ON public.artikel_foto_log TO service_role;
ALTER TABLE public.artikel_foto_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY artikel_foto_log_admin ON public.artikel_foto_log FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2');
CREATE TABLE public.artikel_foto_inventaris (url text PRIMARY KEY, sha256 text NOT NULL, phash bit(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.artikel_foto_inventaris TO authenticated;
GRANT ALL ON public.artikel_foto_inventaris TO service_role;
ALTER TABLE public.artikel_foto_inventaris ENABLE ROW LEVEL SECURITY;
CREATE POLICY artikel_foto_inventaris_admin ON public.artikel_foto_inventaris FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2');
CREATE TABLE public.artikel_foto_worker (id boolean PRIMARY KEY DEFAULT true CHECK(id), lease uuid, lease_tot timestamptz);
GRANT ALL ON public.artikel_foto_worker TO service_role;
ALTER TABLE public.artikel_foto_worker ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.artikel_foto_publicatie_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.is_published IS TRUE AND (NEW.published_at IS NULL OR NEW.published_at >= '2026-10-27 00:00:00 Europe/Amsterdam'::timestamptz) THEN
  IF NEW.is_test THEN RAISE EXCEPTION 'Testartikel mag niet worden gepubliceerd'; END IF;
  IF NEW.image_url IS NULL OR NOT EXISTS(SELECT 1 FROM public.artikel_fotos f WHERE f.article_id=NEW.id AND f.image_url=NEW.image_url AND f.slug=NEW.slug AND NOT f.is_test AND f.storage_pad LIKE 'fotos/%' AND f.storage_pad NOT LIKE '%-og.webp') THEN RAISE EXCEPTION 'Publicatie geweigerd: nieuwe artikelen vanaf 27 oktober vereisen een gecontroleerde unieke foto uit article-images/fotos/'; END IF;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_publicatie_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aa_artikel_foto_publicatie BEFORE INSERT OR UPDATE OF is_published,published_at,image_url,slug,is_test ON public.articles FOR EACH ROW EXECUTE FUNCTION public.artikel_foto_publicatie_guard();
CREATE OR REPLACE FUNCTION public.artikel_afbeelding_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.is_published IS TRUE AND NEW.image_url IS NULL AND NEW.foto_bron_url IS NULL THEN INSERT INTO public.article_image_jobs(article_id) VALUES(NEW.id) ON CONFLICT(article_id) DO UPDATE SET status='pending',requested_at=now() WHERE article_image_jobs.status <> 'running'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.artikel_foto_dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.artikel_foto_jobs WHERE status='wacht' AND (lease_tot IS NULL OR lease_tot<now())) THEN
  PERFORM net.http_post(url:='https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/artikel-foto',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_dispatch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_foto_dispatch() TO service_role;
CREATE OR REPLACE FUNCTION public.artikel_foto_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.foto_bron_url IS NOT NULL AND NEW.foto_bron_url<>'' AND NEW.image_url IS NULL THEN
 INSERT INTO public.artikel_foto_jobs(article_id,bron_url) VALUES(NEW.id,NEW.foto_bron_url) ON CONFLICT(article_id,bron_url) DO NOTHING;
 BEGIN PERFORM public.artikel_foto_dispatch(); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Foto staat in wachtrij; automatische herpoging volgt'; END;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_wekken() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER artikel_foto_wekken AFTER INSERT OR UPDATE OF foto_bron_url ON public.articles FOR EACH ROW EXECUTE FUNCTION public.artikel_foto_wekken();
CREATE OR REPLACE FUNCTION public.artikel_foto_claim(p_lease uuid) RETURNS SETOF public.artikel_foto_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO public.artikel_foto_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE public.artikel_foto_worker SET lease=p_lease,lease_tot=now()+interval '4 minutes' WHERE id=true AND (lease_tot IS NULL OR lease_tot<now());
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY UPDATE public.artikel_foto_jobs SET lease=p_lease,lease_tot=now()+interval '4 minutes' WHERE id=(SELECT id FROM public.artikel_foto_jobs WHERE status='wacht' AND (lease_tot IS NULL OR lease_tot<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_foto_claim(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.artikel_foto_vastleggen(p_job uuid,p_lease uuid,p_foto jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.artikel_foto_jobs; a public.articles; v_id uuid; v_hash bit(64); v_url text; v_pad text;
BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000080);
 SELECT * INTO j FROM public.artikel_foto_jobs WHERE id=p_job AND lease=p_lease AND lease_tot>now() AND status='wacht' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Foto-opdracht verlopen'; END IF;
 SELECT * INTO a FROM public.articles WHERE id=j.article_id FOR UPDATE;
 IF a.image_url IS NOT NULL OR a.foto_bron_url IS DISTINCT FROM j.bron_url THEN RAISE EXCEPTION 'Artikel gewijzigd; bestaande afbeelding behouden'; END IF;
 IF (p_foto->>'sha256') !~ '^[a-f0-9]{64}$' OR (p_foto->>'bron_sha256') !~ '^[a-f0-9]{64}$' OR (p_foto->>'phash') !~ '^[a-f0-9]{16}$' OR a.slug !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'Ongeldige fotogegevens'; END IF;
 v_hash:=('x'||(p_foto->>'phash'))::bit(64);
 v_pad:='fotos/'||a.slug||'-'||left(p_foto->>'sha256',8)||'.webp';
 v_url:='https://eugkavokktjwpqaqlwsj.supabase.co/storage/v1/object/public/article-images/'||v_pad;
 IF p_foto->>'storage_pad' IS DISTINCT FROM v_pad OR p_foto->>'image_url' IS DISTINCT FROM v_url OR (p_foto->>'breedte')::int<>1600 OR (p_foto->>'hoogte')::int NOT BETWEEN 1 AND 3200 OR p_foto->>'bron_host' NOT IN ('cdn.higgsfield.ai','static-public-media.higgsfield.ai','static.higgsfield.ai') THEN RAISE EXCEPTION 'Ongeldige foto-opslag of bron'; END IF;
 IF EXISTS(SELECT 1 FROM public.articles old WHERE old.image_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.artikel_foto_inventaris i WHERE i.url=old.image_url) AND NOT EXISTS(SELECT 1 FROM public.artikel_fotos f WHERE f.image_url=old.image_url)) THEN RAISE EXCEPTION 'Fotocontrole wacht op inventaris van bestaande artikelbeelden'; END IF;
 IF EXISTS(SELECT 1 FROM public.artikel_fotos f WHERE f.sha256=p_foto->>'sha256' OR f.bron_sha256=p_foto->>'bron_sha256') OR EXISTS(SELECT 1 FROM public.artikel_foto_inventaris i WHERE i.sha256=p_foto->>'bron_sha256' OR i.sha256=p_foto->>'sha256') THEN RAISE EXCEPTION 'Foto geweigerd: identieke foto bestaat al'; END IF;
 IF EXISTS(SELECT 1 FROM public.artikel_fotos f WHERE bit_count(f.phash # v_hash)<=8) OR EXISTS(SELECT 1 FROM public.artikel_foto_inventaris i WHERE bit_count(i.phash # v_hash)<=8) THEN RAISE EXCEPTION 'Foto geweigerd: bijna-dubbele foto bestaat al (pHash-afstand maximaal 8)'; END IF;
 INSERT INTO public.artikel_fotos(article_id,slug,bron_url,bron_host,storage_pad,image_url,sha256,bron_sha256,phash,breedte,hoogte,prompt,is_test) VALUES(a.id,a.slug,j.bron_url,p_foto->>'bron_host',v_pad,v_url,p_foto->>'sha256',p_foto->>'bron_sha256',v_hash,1600,(p_foto->>'hoogte')::int,a.foto_prompt,a.is_test) RETURNING id INTO v_id;
 UPDATE public.articles SET image_url=v_url WHERE id=a.id;
 UPDATE public.artikel_foto_jobs SET status='klaar',completed_at=now(),lease=NULL,lease_tot=NULL,bron_host=p_foto->>'bron_host' WHERE id=j.id;
 INSERT INTO public.artikel_foto_log(article_id,job_id,status,bron_host) VALUES(a.id,j.id,'klaar',p_foto->>'bron_host'); RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_vastleggen(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artikel_foto_vastleggen(uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.artikel_foto_status(p_slug text) RETURNS TABLE(status text,reden text,image_url text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (session_user IN ('postgres','service_role') OR auth.role()='service_role' OR (public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2')) THEN RAISE EXCEPTION 'Alleen beheer met tweestapslogin'; END IF;
 IF length(p_slug)>200 OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'Ongeldige slug'; END IF;
 RETURN QUERY SELECT CASE WHEN f.id IS NOT NULL THEN 'klaar' WHEN j.status='geweigerd' THEN 'geweigerd' ELSE 'wacht' END,j.reden,a.image_url FROM public.articles a LEFT JOIN public.artikel_fotos f ON f.article_id=a.id AND f.image_url=a.image_url LEFT JOIN public.artikel_foto_jobs j ON j.article_id=a.id AND j.bron_url=a.foto_bron_url WHERE a.slug=p_slug;
END $$;
REVOKE ALL ON FUNCTION public.artikel_foto_status(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artikel_foto_status(text) TO service_role,authenticated;