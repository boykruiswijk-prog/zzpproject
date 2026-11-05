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
  RETURN NEW;
END $function$;