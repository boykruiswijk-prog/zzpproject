-- Klanten nooit een interne opzegreden op een lead laten opslaan; bestaande historie blijft ongewijzigd.
CREATE OR REPLACE FUNCTION public.lead_opzeg_reden_controle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid;
  is_team boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.opzeg_reden IS NOT DISTINCT FROM OLD.opzeg_reden
     AND NEW.opzeg_toelichting IS NOT DISTINCT FROM OLD.opzeg_toelichting
     AND NEW.opzeg_door IS NOT DISTINCT FROM OLD.opzeg_door THEN
    RETURN NEW;
  END IF;
  IF NEW.opzeg_reden IS NULL THEN RETURN NEW; END IF;

  -- Bij een echte gebruikerssessie telt altijd de ingelogde gebruiker. Alleen de
  -- vertrouwde service-route gebruikt opzeg_door, die polis-lifecycle uit de JWT zet.
  actor := auth.uid();
  IF actor IS NULL AND coalesce(auth.role(), '') = 'service_role' THEN
    actor := NEW.opzeg_door;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = actor AND role IN ('admin','medewerker','supervisor','verzekering')
  ) INTO is_team;

  IF NEW.opzeg_reden IN ('beeindiging_zp','eerdere_opzegging') AND NOT is_team THEN
    RAISE EXCEPTION 'Deze opzegreden kan alleen het team kiezen.';
  END IF;
  IF NEW.opzeg_reden = 'anders' AND length(btrim(coalesce(NEW.opzeg_toelichting, ''))) < 3 THEN
    RAISE EXCEPTION 'Geef een toelichting van minimaal 3 tekens.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lead_opzeg_reden_controle() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.lead_opzeg_reden_controle() IS 'Vangnet voor polis-lifecycle: interne opzegredenen alleen met echte teamrol; anders vereist 3 tekens toelichting.';

DROP TRIGGER IF EXISTS aa_lead_opzeg_reden_controle_insert ON public.leads;
CREATE TRIGGER aa_lead_opzeg_reden_controle_insert
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.lead_opzeg_reden_controle();
DROP TRIGGER IF EXISTS aa_lead_opzeg_reden_controle_update ON public.leads;
CREATE TRIGGER aa_lead_opzeg_reden_controle_update
BEFORE UPDATE OF opzeg_reden, opzeg_toelichting, opzeg_door ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.lead_opzeg_reden_controle();

CREATE OR REPLACE FUNCTION public._ts_polis_lifecycle_opzeg()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  klant_uid constant uuid := '7e570000-0000-4000-8000-00000000000c';
  adm constant uuid := '5d591f12-d010-4640-ae68-2b4f58953320';
  lead_id constant uuid := '7e570000-0000-4000-8000-0000000001d2';
  c jsonb := '[]';
  f text;
BEGIN
  INSERT INTO public.leads (id, type, status, voornaam, achternaam, email, bedrijfsnaam, gekozen_pakket, is_test)
  VALUES (lead_id, 'verzekering_aanvraag', 'actief', 'Test', 'Lifecycle', 'test+lifecycle@zpzaken.nl', 'Testpersoon lifecycle', 'jaarlijks', true);
  PERFORM public._ts_sessie(klant_uid, 'aal1');

  f := public._ts_fout(format('UPDATE public.leads SET opzeg_reden = %L, opzeg_toelichting = NULL, opzeg_door = %L WHERE id = %L', 'beeindiging_zp', klant_uid, lead_id));
  c := c || public._ts_c('klant via polis-lifecycle: beeindiging_zp geweigerd', 'Deze opzegreden kan alleen het team kiezen.', f);
  f := public._ts_fout(format('UPDATE public.leads SET opzeg_reden = %L, opzeg_toelichting = NULL, opzeg_door = %L WHERE id = %L', 'eerdere_opzegging', klant_uid, lead_id));
  c := c || public._ts_c('klant via polis-lifecycle: eerdere_opzegging geweigerd', 'Deze opzegreden kan alleen het team kiezen.', f);
  f := public._ts_fout(format('UPDATE public.leads SET opzeg_reden = %L, opzeg_toelichting = NULL, opzeg_door = %L WHERE id = %L', 'anders', klant_uid, lead_id));
  c := c || public._ts_c('klant: anders zonder toelichting geweigerd', 'Geef een toelichting van minimaal 3 tekens.', f);
  c := c || public._ts_c('geen opzegreden opgeslagen na weigeringen', NULL, (SELECT opzeg_reden FROM public.leads WHERE id = lead_id));

  UPDATE public.leads SET opzeg_reden = 'pensioen', opzeg_toelichting = NULL, opzeg_door = klant_uid WHERE id = lead_id;
  c := c || public._ts_c('klant: portaallijst blijft toegestaan', 'pensioen', (SELECT opzeg_reden FROM public.leads WHERE id = lead_id));

  PERFORM public._ts_sessie(adm, 'aal2');
  UPDATE public.leads SET opzeg_reden = 'beeindiging_zp', opzeg_toelichting = 'Scenario beheer', opzeg_door = adm WHERE id = lead_id;
  c := c || public._ts_c('beheer: beeindiging_zp toegestaan', 'beeindiging_zp', (SELECT opzeg_reden FROM public.leads WHERE id = lead_id));
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_polis_lifecycle_opzeg() FROM PUBLIC, anon, authenticated;

DO $mig$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.test_scenario'::regproc); o := d;
  d := replace(d, $a$'opzegreden_beheer_beeindiging_zp'] || vitest;$a$,
    $a$'opzegreden_beheer_beeindiging_zp','polis_lifecycle_klant_beeindiging_zp'] || vitest;$a$);
  d := replace(d, $a$      c := c || public._ts_opzegreden(p_naam);
    ELSE$a$, $a$      c := c || public._ts_opzegreden(p_naam);
    ELSIF p_naam = 'polis_lifecycle_klant_beeindiging_zp' THEN
      c := c || public._ts_polis_lifecycle_opzeg();
    ELSE$a$);
  IF d = o OR strpos(d, '_ts_polis_lifecycle_opzeg()') = 0 OR strpos(d, '''polis_lifecycle_klant_beeindiging_zp''] || vitest') = 0 THEN
    RAISE EXCEPTION 'test_scenario niet aangepast';
  END IF;
  EXECUTE d;
END $mig$;