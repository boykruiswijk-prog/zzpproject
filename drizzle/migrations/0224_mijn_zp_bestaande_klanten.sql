-- Plaatsaanduidingen ('-') in naamvelden van contactpersonen tellen als leeg.
CREATE OR REPLACE FUNCTION public.personen_naam_plaatsaanduiding_leeg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.voornaam IS NOT NULL AND trim(NEW.voornaam) IN ('', '-', '--', '.') THEN NEW.voornaam := NULL; END IF;
  IF NEW.achternaam IS NOT NULL AND trim(NEW.achternaam) IN ('', '-', '--', '.') THEN NEW.achternaam := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS personen_naam_plaatsaanduiding ON public.personen;
CREATE TRIGGER personen_naam_plaatsaanduiding BEFORE INSERT OR UPDATE OF voornaam, achternaam ON public.personen
  FOR EACH ROW EXECUTE FUNCTION public.personen_naam_plaatsaanduiding_leeg();

-- Mijn ZP: lopende BAV/cyber-contracten van bestaande klanten (zonder online aanvraag) via het bevestigde inlogadres.
CREATE OR REPLACE FUNCTION public.mijn_klant_contracten()
RETURNS TABLE(product text, status text, begin_datum date, certificaatnummer text, onderneming_naam text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mij AS (
    SELECT lower(trim(u.email)) AS email FROM auth.users u
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  ), ond AS (
    SELECT DISTINCT o.id, o.naam
    FROM mij
    JOIN public.personen p ON lower(p.genormaliseerd_email) = mij.email AND coalesce(p.is_test, false) = false
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
    WHERE coalesce(o.is_test, false) = false AND o.samengevoegd_naar IS NULL
  )
  SELECT kc.product::text, kc.status::text, kc.begin_datum,
         (SELECT c.certificaatnummer FROM public.klant_certificaten c
           WHERE c.onderneming_id = ond.id AND c.koppeling_status = 'bevestigd' AND coalesce(c.is_test, false) = false
           ORDER BY c.created_at DESC LIMIT 1),
         ond.naam
  FROM ond JOIN public.klant_contracten kc ON kc.onderneming_id = ond.id
  WHERE kc.status = 'actief' AND coalesce(kc.is_test, false) = false
    AND (kc.product ILIKE 'bav%' OR kc.product ILIKE 'cyber%')
  ORDER BY kc.begin_datum DESC
$$;
REVOKE ALL ON FUNCTION public.mijn_klant_contracten() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_klant_contracten() TO authenticated;