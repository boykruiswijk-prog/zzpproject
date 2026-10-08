CREATE OR REPLACE FUNCTION public.artikel_afbeelding_wekken()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_published IS TRUE AND (NEW.image_url IS NULL) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/artikel-afbeelding',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.artikel_afbeelding_wekken() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS artikel_afbeelding_wekken ON public.articles;
CREATE TRIGGER artikel_afbeelding_wekken AFTER INSERT OR UPDATE OF is_published, image_url, title ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.artikel_afbeelding_wekken();