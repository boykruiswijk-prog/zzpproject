CREATE OR REPLACE FUNCTION public.artikel_hiscox_acceptatie_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE zin text;
BEGIN
  FOR zin IN SELECT regexp_split_to_table(concat_ws(E'\n', NEW.title, NEW.excerpt, NEW.content, NEW.seo_title, NEW.seo_description), '[.!?;\n]') LOOP
    IF zin ~* 'hiscox' AND zin ~* '(accept|beoordeel|beslis)' THEN
      RAISE EXCEPTION 'Artikel geweigerd: acceptatie wordt aan Hiscox toegeschreven ("%"). ZP Zaken (Ellen Baars) beoordeelt aanvragen zelf (register F1-aanvulling 2).', btrim(zin)
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.artikel_hiscox_acceptatie_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS artikel_hiscox_acceptatie_check ON public.articles;
CREATE TRIGGER artikel_hiscox_acceptatie_check BEFORE INSERT OR UPDATE OF title, excerpt, content, seo_title, seo_description ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.artikel_hiscox_acceptatie_check();