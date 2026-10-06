CREATE TABLE IF NOT EXISTS public.indexnow_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bron text NOT NULL,
  urls text[] NOT NULL DEFAULT '{}',
  aantal integer NOT NULL DEFAULT 0,
  ok boolean,
  http_status integer,
  fout text,
  verwerkt_op timestamptz
);
GRANT SELECT ON public.indexnow_log TO authenticated;
GRANT ALL ON public.indexnow_log TO service_role;
ALTER TABLE public.indexnow_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Supervisors lezen indexnow_log" ON public.indexnow_log;
CREATE POLICY "Supervisors lezen indexnow_log" ON public.indexnow_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Trigger zet de URL in de wachtrij en wekt de functie; de functie meldt alleen
-- URL's die al in de wachtrij staan, dus het wekken vraagt geen geheim.
CREATE OR REPLACE FUNCTION public.indexnow_artikel_ping()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published IS NOT TRUE OR NEW.slug IS NULL OR NEW.slug !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE
     AND OLD.slug IS NOT DISTINCT FROM NEW.slug
     AND OLD.title IS NOT DISTINCT FROM NEW.title
     AND OLD.content IS NOT DISTINCT FROM NEW.content
     AND OLD.excerpt IS NOT DISTINCT FROM NEW.excerpt
     AND OLD.seo_description IS NOT DISTINCT FROM NEW.seo_description THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.indexnow_log (bron, urls, aantal)
  VALUES ('artikel_trigger', ARRAY['/kennisbank/' || NEW.slug], 1);
  BEGIN
    PERFORM net.http_post(
      url := 'https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/indexnow-ping',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('wachtrij', true)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.indexnow_artikel_ping() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_indexnow_artikel ON public.articles;
CREATE TRIGGER trg_indexnow_artikel
  AFTER INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.indexnow_artikel_ping();