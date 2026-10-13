-- Besluit D4 (Boy 13 okt 2026): ingangsdatum vroegst de dag na de aanvraag (Europe/Amsterdam).

CREATE OR REPLACE FUNCTION public.ingangsdatum_vroegst_leads()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE dag date; vroegst date; oud date; oud_cyber date; delta int;
BEGIN
  IF NEW.type IS DISTINCT FROM 'verzekering_aanvraag'::lead_type THEN RETURN NEW; END IF;
  dag := (coalesce(NEW.created_at, now()) AT TIME ZONE 'Europe/Amsterdam')::date;
  vroegst := dag + 1;
  oud := NEW.ingangsdatum; oud_cyber := NEW.cyber_ingangsdatum;
  IF NEW.ingangsdatum IS NOT NULL AND NEW.ingangsdatum < vroegst THEN NEW.ingangsdatum := vroegst; END IF;
  IF NEW.cyber_ingangsdatum IS NOT NULL AND NEW.cyber_ingangsdatum < vroegst THEN
    delta := vroegst - NEW.cyber_ingangsdatum;
    NEW.cyber_ingangsdatum := vroegst;
    IF NEW.cyber_einddatum IS NOT NULL THEN NEW.cyber_einddatum := NEW.cyber_einddatum + delta; END IF;
  END IF;
  IF oud IS DISTINCT FROM NEW.ingangsdatum OR oud_cyber IS DISTINCT FROM NEW.cyber_ingangsdatum THEN
    NEW.activatie_log := (CASE WHEN jsonb_typeof(NEW.activatie_log) = 'array' THEN NEW.activatie_log ELSE '[]'::jsonb END)
      || jsonb_build_array(jsonb_build_object('tijd', now(), 'actie', 'ingangsdatum_gecorrigeerd',
         'oud', oud, 'nieuw', NEW.ingangsdatum, 'cyber_oud', oud_cyber, 'cyber_nieuw', NEW.cyber_ingangsdatum,
         'reden', 'vroegst dag na aanvraag', 'door', 'database'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aa_ingangsdatum_vroegst ON public.leads;
CREATE TRIGGER aa_ingangsdatum_vroegst BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.ingangsdatum_vroegst_leads();

CREATE OR REPLACE FUNCTION public.ingangsdatum_vroegst_bav()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE vroegst date := (now() AT TIME ZONE 'Europe/Amsterdam')::date + 1;
BEGIN
  IF NEW.ingangsdatum IS NOT NULL AND NEW.ingangsdatum < vroegst THEN NEW.ingangsdatum := vroegst; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aa_ingangsdatum_vroegst ON public.bav_aanmeldingen;
CREATE TRIGGER aa_ingangsdatum_vroegst BEFORE INSERT ON public.bav_aanmeldingen
  FOR EACH ROW EXECUTE FUNCTION public.ingangsdatum_vroegst_bav();

REVOKE ALL ON FUNCTION public.ingangsdatum_vroegst_leads() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingangsdatum_vroegst_bav() FROM PUBLIC, anon, authenticated;

-- Interne wijziging: weiger een datum op of voor de aanvraagdag.
DO $do$
DECLARE def text; anker text := $a$IF oud IS NOT DISTINCT FROM _datum THEN RAISE EXCEPTION 'datum is ongewijzigd'; END IF;$a$;
BEGIN
  def := pg_get_functiondef('public.lead_ingangsdatum_wijzigen(uuid,date,text)'::regprocedure);
  IF position(anker in def) = 0 THEN RAISE EXCEPTION 'anker niet gevonden in lead_ingangsdatum_wijzigen'; END IF;
  IF position('vroegst de dag na de aanvraag' in def) = 0 THEN
    def := replace(def, anker, anker || $c$
  IF _datum <= (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date THEN
    RAISE EXCEPTION 'De ingangsdatum is vroegst de dag na de aanvraag (%).', to_char((l.created_at AT TIME ZONE 'Europe/Amsterdam')::date + 1, 'DD-MM-YYYY');
  END IF;$c$);
    EXECUTE def;
  END IF;
END $do$;