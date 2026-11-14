CREATE OR REPLACE FUNCTION public.artikel_hiscox_acceptatie_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE zin text;
BEGIN
  FOR zin IN SELECT regexp_split_to_table(concat_ws(E'\n', NEW.title, NEW.excerpt, NEW.content, NEW.seo_title, NEW.seo_description), '[.!?;\n]') LOOP
    IF zin ~* 'hiscox' AND zin ~* '(accept|beoordeel|beslis)' THEN
      RAISE EXCEPTION 'Artikel geweigerd: acceptatie wordt aan Hiscox toegeschreven ("%"). ZP Zaken (Ellen Baars) beoordeelt aanvragen zelf (register F1-aanvulling 2).', btrim(zin)
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  -- Kwaliteitscontrole 5-11 (F1-aanvulling, F9): AOV-aanbiedersnamen alleen op /aov, nooit in gepubliceerde artikelen.
  IF COALESCE(NEW.is_published, false)
     AND concat_ws(E'\n', NEW.title, NEW.excerpt, NEW.content, NEW.seo_title, NEW.seo_description, NEW.foto_alt) ~* '(movir|nationale-nederlanden)' THEN
    RAISE EXCEPTION 'Artikel geweigerd: aanbiedersnaam Movir of Nationale-Nederlanden hoort alleen op de AOV-pagina (kwaliteitscontrole 5-11).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.is_published, false)
     AND COALESCE(NEW.content, '') ~* '(cybervoorwaarden|voorwaarden voor cyber).{0,120}\m(opvraagt|opvragen|vraag je op)\M' THEN
    RAISE EXCEPTION 'Artikel geweigerd: cybervoorwaarden staan op /voorwaarden#cyber, niet opvragen (CYBERBLAD punt 11).'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Kwaliteitscontrole 13-11 (TEKSTNORM punt 1): geen adviseur in beroepsnamen. 'financieel adviseurs' blijft toegestaan.
  IF COALESCE(NEW.is_published, false)
     AND COALESCE(NEW.content, '') ~* '(hr-adviseur|loopbaanadviseur)' THEN
    RAISE EXCEPTION 'Artikel geweigerd: beroepsnaam met adviseur (HR-adviseur of loopbaanadviseur); gebruik bijvoorbeeld HR-professional (TEKSTNORM punt 1).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.is_published IS TRUE
     AND (NEW.published_at IS NULL OR NEW.published_at >= '2026-11-14 00:00:00 Europe/Amsterdam'::timestamptz)
     AND (COALESCE(NEW.content, '') !~* 'algemene informatie'
          OR COALESCE(NEW.content, '') !~* 'stand van zaken') THEN
    RAISE EXCEPTION 'Artikel geweigerd: slotregel algemene informatie en/of Stand van zaken ontbreekt (register F1).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS artikel_hiscox_acceptatie_check ON public.articles;
CREATE TRIGGER artikel_hiscox_acceptatie_check BEFORE INSERT OR UPDATE OF title, excerpt, content, seo_title, seo_description, is_published, published_at ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.artikel_hiscox_acceptatie_check();