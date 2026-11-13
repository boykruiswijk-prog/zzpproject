-- Publicatiecontrole fiscale tokens (13-11). Lijst gegenereerd door scripts/fiscaleTokenSql.ts (fiscaleTokenCompact), parity-test fiscaleTokensPublicatie.test.ts.
CREATE OR REPLACE FUNCTION public.fiscaal_token_onopgelost(_tekst text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $f$
DECLARE
  _sleutels constant text[] := ARRAY['aftrekpercentageGemengdeKosten:-:2026','aowAlleenstaandJuli:E:2026','aowFranchise:E:2026','aowLeeftijd:-:2026','aowSamenwonendJuli:E:2026','bijtellingDrempelCataloguswaarde:E:2026','bijtellingPriveKilometergrens:-:2026','bijtellingStandaardtarief:-:2026','bijtellingVastePeriode:-:2026','bijtellingVerlaagdTarief:-:2025,2026','bijtellingYoungtimerLeeftijd:-:2025,2026','bijtellingYoungtimerTarief:-:2026','drempelGemengdeKosten:E:2024,2025,2026','jaarruimtePercentage:-:2022,2026','kiaAfbouwpercentage:-:2025,2026','kiaBovengrens:E:2025,2026','kiaGrensEersteSchijf:E:2025,2026','kiaGrensTweedeSchijf:E:2025,2026','kiaMinimumPerBedrijfsmiddel:E:2026','kiaOndergrens:E:2026','kiaPercentageEersteSchijf:-:2026','kiaVastBedragTweedeSchijf:E:2025,2026','kilometeraftrekOndernemer:E:2025,2026','korOmzetgrens:E:2025,2026','kvkInschrijfkosten:E:2025,2026','lijfrenteFranchise:E:2026','lijfrenteMinimaleUitkering:-:2026','maximaleAlgemeneHeffingskorting:E:2026','maximaleArbeidskorting:E:2026','maximaleReserveringsruimte:E:2026','maximumPensioengevendLoon:E:2026','mkbWinstvrijstelling:-:2026','onbelasteKilometervergoedingWerknemer:E:2025,2026','revisierente:-:2026','schijf1Grens:E:2025,2026','schijf1Tarief:-:2025,2026','schijf2Grens:E:2026','schijf2Tarief:-:2026','schijf3Tarief:-:2026','startersaftrek:E:2026,2027','tariefcorrectieAftrekposten:-:2025,2026','urencriterium:-:2026','zelfstandigenaftrek:E:2024,2025,2026,2027','zelfstandigenaftrekAowLeeftijd:E:2026','zvwBijdrageOndernemers:-:2025,2026','zvwMaximaleBijdrage:E:2026','zvwMaximumBijdrageInkomen:E:2025,2026','zvwWerkgeversheffing:-:2025,2026']::text[];
  _afgeleid constant text[] := ARRAY['nulgrensAlgemeneHeffingskorting','nulgrensArbeidskorting','nulgrensBelastbaarInkomen','nulgrensBelastingSchijf1','nulgrensMkbVrijstelling','nulgrensOndernemersaftrek','nulgrensTeBetalen','nulgrensWinst','nulgrensWinstNaOndernemersaftrek']::text[];
  m text[]; ruw text; s text; v text; rij text; euro boolean; jaren text[]; ok boolean;
BEGIN
  IF _tekst IS NULL THEN RETURN NULL; END IF;
  FOR m IN SELECT regexp_matches(_tekst, '\{\{\s*fiscaal:([^}]*?)\s*\}\}', 'g') LOOP
    ruw := m[1];
    IF ruw !~ '^[A-Za-z0-9_\\]+(:[A-Za-z0-9_\\]+)?$' THEN RETURN '{{fiscaal:' || ruw || '}}'; END IF;
    s := replace(split_part(ruw, ':', 1), '\', '');
    v := replace(split_part(ruw, ':', 2), '\', '');
    IF s = ANY(_afgeleid) THEN CONTINUE; END IF;
    SELECT x INTO rij FROM unnest(_sleutels) x WHERE split_part(x, ':', 1) = s;
    IF rij IS NULL THEN RETURN '{{fiscaal:' || ruw || '}}'; END IF;
    euro := split_part(rij, ':', 2) = 'E';
    jaren := string_to_array(split_part(rij, ':', 3), ',');
    ok := v IN ('', 'waarde', 'jaar', 'label', 'volledig', 'bron')
      OR (v = 'euro' AND euro)
      OR (v = ANY(jaren))
      OR (euro AND v ~ '^\d{4}_euro$' AND left(v, 4) = ANY(jaren));
    IF NOT ok THEN RETURN '{{fiscaal:' || ruw || '}}'; END IF;
  END LOOP;
  RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION public.fiscaal_token_onopgelost(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.artikel_fiscaal_token_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
DECLARE _t text;
BEGIN
  IF NOT coalesce(NEW.is_published, false) THEN RETURN NEW; END IF;
  _t := coalesce(public.fiscaal_token_onopgelost(NEW.content), public.fiscaal_token_onopgelost(NEW.title),
    public.fiscaal_token_onopgelost(NEW.excerpt), public.fiscaal_token_onopgelost(NEW.seo_title),
    public.fiscaal_token_onopgelost(NEW.seo_description));
  IF _t IS NOT NULL THEN
    RAISE EXCEPTION 'Artikel kan niet live: fiscale token lost niet op: %', _t USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.artikel_fiscaal_token_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS artikel_fiscaal_token_check ON public.articles;
CREATE TRIGGER artikel_fiscaal_token_check BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.artikel_fiscaal_token_check();