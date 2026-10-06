-- Vandaag te doen: afgeronde leads tellen niet meer mee.
DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  n := replace(d, $a$l.geactiveerd_op IS NULL AND l.status NOT IN ('afgewezen','opgezegd')))$a$, $a$l.geactiveerd_op IS NULL AND l.status NOT IN ('afgewezen','opgezegd','afgerond')))$a$);
  n := replace(n, $a$l.status NOT IN ('afgewezen','opgezegd','nieuw','nieuw_te_beoordelen')$a$, $a$l.status NOT IN ('afgewezen','opgezegd','nieuw','nieuw_te_beoordelen','afgerond')$a$);
  n := replace(n, $a$(_toon_test OR NOT l.is_test) AND nullif(trim(coalesce(l.exact_fout,'')),'') IS NOT NULL$a$, $a$(_toon_test OR NOT l.is_test) AND l.status <> 'afgerond' AND nullif(trim(coalesce(l.exact_fout,'')),'') IS NOT NULL$a$);
  IF (length(n) - length(d)) <> length($a$,'afgerond'$a$) * 2 + length($a$ AND l.status <> 'afgerond'$a$) THEN
    RAISE EXCEPTION 'mijn_acties_vandaag: niet alle vervangingen gevonden';
  END IF;
  EXECUTE n;
END $do$;

-- Veiligheid: een verzekeringsaanvraag met (ooit) geactiveerde polis mag nooit op afgerond, zodat de polisstatus niet overschreven wordt.
CREATE OR REPLACE FUNCTION public.guard_lead_afgerond()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'afgerond' AND NEW.status IS DISTINCT FROM OLD.status AND OLD.type = 'verzekering_aanvraag'
     AND (OLD.geactiveerd_op IS NOT NULL OR OLD.status IN ('actief','gepauzeerd','opgezegd','klant')) THEN
    RAISE EXCEPTION 'Niet toegestaan: deze aanvraag heeft een polis; afgerond zou de polisstatus overschrijven.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_guard_lead_afgerond ON public.leads;
CREATE TRIGGER trg_guard_lead_afgerond BEFORE UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_lead_afgerond();

-- Audit: afronden en heropenen altijd in activiteiten_log (wie, wanneer, toelichting).
CREATE OR REPLACE FUNCTION public.log_lead_afgerond()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_naam text; v_toel text := nullif(btrim(current_setting('app.afrond_toelichting', true)), '');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'afgerond' OR OLD.status = 'afgerond') THEN
    SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email, is_test)
    VALUES (CASE WHEN NEW.status = 'afgerond' THEN 'lead_afgerond' ELSE 'lead_heropend' END,
      CASE WHEN NEW.status = 'afgerond' THEN 'Afgerond' ELSE 'Heropend, status ' || NEW.status::text END || coalesce('. Toelichting: ' || v_toel, ''),
      auth.uid(), coalesce(v_naam, CASE WHEN auth.uid() IS NULL THEN 'systeem' ELSE 'teamlid' END), NEW.id, lower(NEW.email), NEW.is_test);
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.log_lead_afgerond() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_log_lead_afgerond ON public.leads;
CREATE TRIGGER trg_log_lead_afgerond AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_afgerond();

-- Afronden met optionele toelichting (teamlid). Heropenen gaat via gewone statuswijziging en wordt door de trigger gelogd.
CREATE OR REPLACE FUNCTION public.lead_afronden(_lead_id uuid, _toelichting text DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting maximaal 500 tekens'; END IF;
  PERFORM set_config('app.afrond_toelichting', coalesce(_toelichting,''), true);
  UPDATE public.leads SET status = 'afgerond' WHERE id = _lead_id AND status <> 'afgerond';
  IF NOT FOUND THEN RAISE EXCEPTION 'lead niet gevonden of al afgerond'; END IF;
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.lead_afronden(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lead_afronden(uuid, text) TO authenticated;