ALTER TABLE public.factuur_credit_planning ADD COLUMN bedrag_handmatig boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.factuur_credit_planning.bedrag_handmatig IS 'Expliciet vastgelegd bedrag: planner mag bedrag of berekening nooit herberekenen. Bron correctie is altijd vast.';
CREATE OR REPLACE FUNCTION public.guard_credit_vast_bedrag() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.bedrag_handmatig OR (OLD.bron = 'correctie' AND (OLD.beoordeeld_op IS NOT NULL OR OLD.status IN ('te_maken','geclaimd','concept_aangemaakt','verwerkt','handmatig_afgehandeld'))) THEN
    IF NEW.bedrag IS DISTINCT FROM OLD.bedrag OR NEW.berekening IS DISTINCT FROM OLD.berekening OR NEW.bron IS DISTINCT FROM OLD.bron OR NEW.bedrag_handmatig IS DISTINCT FROM OLD.bedrag_handmatig THEN
      RAISE EXCEPTION 'Vastgelegd creditbedrag mag niet wijzigen na vastlegging/goedkeuring (%)', OLD.creditsleutel USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_credit_vast_bedrag() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_credit_vast_bedrag BEFORE UPDATE ON public.factuur_credit_planning FOR EACH ROW EXECUTE FUNCTION public.guard_credit_vast_bedrag();
DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.herbeoordeel_opzeg_credits()'::regprocedure);
  IF position('AND bron <> ''correctie''' IN d) = 0 THEN RAISE EXCEPTION 'herbeoordeel bron-filter ontbreekt'; END IF;
  d := replace(d, 'AND bron <> ''correctie''', 'AND bron <> ''correctie'' AND NOT bedrag_handmatig');
  EXECUTE d;
END $$;