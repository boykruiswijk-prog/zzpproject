-- C-aanvulling Factuurplanner 429: status 'tijdelijk' = Exact weigerde tijdelijk (429/503) vóór aanmaken; volgende dagrun pakt de periode opnieuw op.
ALTER TABLE public.factuur_planning DROP CONSTRAINT IF EXISTS factuur_planning_status_check;
ALTER TABLE public.factuur_planning ADD CONSTRAINT factuur_planning_status_check CHECK (status = ANY (ARRAY['geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout','vervangen','geblokkeerd','tijdelijk']));
DROP INDEX IF EXISTS public.factuur_planning_uniek_actief;
CREATE UNIQUE INDEX factuur_planning_uniek_actief ON public.factuur_planning (klant_contract_id, periode_start) WHERE status NOT IN ('vervangen','tijdelijk');
DO $mig$
DECLARE f text; def text; n int;
BEGIN
  FOREACH f IN ARRAY ARRAY['facturatie_kandidaten','facturatie_testcontract'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p WHERE p.proname = f AND p.pronamespace = 'public'::regnamespace;
    n := (length(def) - length(replace(def, 'fp.status <> ''vervangen''', ''))) / length('fp.status <> ''vervangen''');
    IF n <> 1 THEN RAISE EXCEPTION '% bevat % keer de verwachte join', f, n; END IF;
    EXECUTE replace(def, 'fp.status <> ''vervangen''', 'fp.status NOT IN (''vervangen'',''tijdelijk'')');
  END LOOP;
END $mig$;
COMMENT ON COLUMN public.factuur_planning.status IS 'tijdelijk = Exact weigerde tijdelijk (HTTP 429/503) voordat er iets is aangemaakt; telt niet als bezet en gaat bij de volgende dagrun opnieuw mee.';