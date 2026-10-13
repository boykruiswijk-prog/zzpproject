-- Vlag in de acceptatie (verzoek Boy 13 okt 2026)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vlag text,
  ADD COLUMN IF NOT EXISTS vlag_notitie text,
  ADD COLUMN IF NOT EXISTS vlag_datum date,
  ADD COLUMN IF NOT EXISTS vlag_door uuid,
  ADD COLUMN IF NOT EXISTS vlag_op timestamptz;
ALTER TABLE public.leads ADD CONSTRAINT leads_vlag_soort CHECK (vlag IS NULL OR vlag IN ('later','actie'));
ALTER TABLE public.leads ADD CONSTRAINT leads_vlag_later_datum CHECK (vlag IS DISTINCT FROM 'later' OR vlag_datum IS NOT NULL);
CREATE INDEX IF NOT EXISTS leads_vlag_idx ON public.leads (vlag, vlag_datum) WHERE vlag IS NOT NULL;

-- Geparkeerd = gevlagd en (nog) niet aan de beurt: telt niet mee in Te doen en tellers.
CREATE OR REPLACE FUNCTION public.lead_vlag_geparkeerd(_vlag text, _datum date, _vandaag date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _vlag IS NOT NULL AND (_datum IS NULL OR _datum > _vandaag)
$$;

-- Vlagkolommen alleen via de RPC's
CREATE OR REPLACE FUNCTION public.guard_lead_vlag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('zp.vlag_rpc', true),'0') <> '1' AND (
       NEW.vlag IS DISTINCT FROM OLD.vlag OR NEW.vlag_notitie IS DISTINCT FROM OLD.vlag_notitie
    OR NEW.vlag_datum IS DISTINCT FROM OLD.vlag_datum OR NEW.vlag_door IS DISTINCT FROM OLD.vlag_door
    OR NEW.vlag_op IS DISTINCT FROM OLD.vlag_op) THEN
    RAISE EXCEPTION 'Vlag alleen wijzigen via Vlag aanpassen' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_lead_vlag ON public.leads;
CREATE TRIGGER trg_guard_lead_vlag BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_lead_vlag();

CREATE OR REPLACE FUNCTION public.zet_lead_vlag(_lead_id uuid, _soort text, _notitie text, _datum date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; naam text; oms text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF _soort IS NULL OR _soort NOT IN ('later','actie') THEN RAISE EXCEPTION 'kies Later aandacht of Actie nodig'; END IF;
  IF length(trim(coalesce(_notitie,''))) < 3 OR length(trim(_notitie)) > 500 THEN RAISE EXCEPTION 'notitie verplicht (3-500 tekens)'; END IF;
  IF _soort = 'later' AND _datum IS NULL THEN RAISE EXCEPTION 'opvolgdatum verplicht bij Later aandacht'; END IF;
  SELECT * INTO l FROM public.leads WHERE id=_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  oms := CASE WHEN l.vlag IS NULL THEN 'Vlag gezet: ' ELSE 'Vlag aangepast: ' END
    || CASE WHEN _soort='later' THEN 'Later aandacht' ELSE 'Actie nodig' END
    || CASE WHEN _datum IS NOT NULL THEN ' (opvolgen ' || to_char(_datum,'DD-MM-YYYY') || ')' ELSE '' END || ': ' || trim(_notitie);
  PERFORM set_config('zp.vlag_rpc','1',true);
  UPDATE public.leads SET vlag=_soort, vlag_notitie=trim(_notitie), vlag_datum=_datum, vlag_door=auth.uid(), vlag_op=now(),
    activatie_log = CASE WHEN activatie_log IS NULL OR jsonb_typeof(activatie_log)='array' THEN coalesce(activatie_log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'tijd', now(), 'actie', 'vlag_gezet', 'soort', _soort, 'datum', _datum, 'notitie', trim(_notitie), 'vorige', l.vlag, 'door', auth.uid(), 'door_naam', naam)) ELSE activatie_log END
  WHERE id=_lead_id;
  PERFORM set_config('zp.vlag_rpc','0',true);
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
  VALUES ('vlag_gezet', oms, auth.uid(), naam, _lead_id, lower(l.email), l.is_test);
  RETURN jsonb_build_object('vlag',_soort,'datum',_datum);
END $$;

CREATE OR REPLACE FUNCTION public.verwijder_lead_vlag(_lead_id uuid, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; naam text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(_toelichting,''))) < 3 OR length(trim(_toelichting)) > 500 THEN RAISE EXCEPTION 'toelichting verplicht (3-500 tekens)'; END IF;
  SELECT * INTO l FROM public.leads WHERE id=_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  IF l.vlag IS NULL THEN RAISE EXCEPTION 'er staat geen vlag'; END IF;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  PERFORM set_config('zp.vlag_rpc','1',true);
  UPDATE public.leads SET vlag=NULL, vlag_notitie=NULL, vlag_datum=NULL, vlag_door=NULL, vlag_op=NULL,
    activatie_log = CASE WHEN activatie_log IS NULL OR jsonb_typeof(activatie_log)='array' THEN coalesce(activatie_log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'tijd', now(), 'actie', 'vlag_verwijderd', 'vorige', l.vlag, 'vorige_notitie', l.vlag_notitie, 'toelichting', trim(_toelichting), 'door', auth.uid(), 'door_naam', naam)) ELSE activatie_log END
  WHERE id=_lead_id;
  PERFORM set_config('zp.vlag_rpc','0',true);
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
  VALUES ('vlag_verwijderd', 'Vlag verwijderd (' || CASE WHEN l.vlag='later' THEN 'Later aandacht' ELSE 'Actie nodig' END || '): ' || trim(_toelichting), auth.uid(), naam, _lead_id, lower(l.email), l.is_test);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.zet_lead_vlag(uuid,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verwijder_lead_vlag(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zet_lead_vlag(uuid,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verwijder_lead_vlag(uuid,text) TO authenticated;

-- Menutellers: geparkeerde vlaggen tellen niet mee; aantal gemarkeerd apart
DO $do$
DECLARE d text := pg_get_functiondef('public.menu_tellers()'::regprocedure); n text;
BEGIN
  n := replace(d, $a$'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag'$a$,
    $a$'aanvragen_gemarkeerd', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag' AND geactiveerd_op IS NULL AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland','offerte_verstuurd') AND public.lead_vlag_geparkeerd(vlag, vlag_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date)),
    'leads_gemarkeerd', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag' AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland') AND public.lead_vlag_geparkeerd(vlag, vlag_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date)),
    'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND NOT public.lead_vlag_geparkeerd(vlag, vlag_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date) AND type = 'verzekering_aanvraag'$a$);
  n := replace(n, $a$'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag'$a$,
    $a$'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND NOT public.lead_vlag_geparkeerd(vlag, vlag_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date) AND type <> 'verzekering_aanvraag'$a$);
  IF n = d OR position('aanvragen_gemarkeerd' in n) = 0 OR (length(n) - length(replace(n,'lead_vlag_geparkeerd','')))/20 <> 4 THEN RAISE EXCEPTION 'menu_tellers niet aangepast'; END IF;
  EXECUTE n;
END $do$;

-- Vandaag te doen: geparkeerde vlaggen uit nieuw/activeren/starter, bereikte vlaggen als eigen blok
DO $do$
DECLARE d text := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure); n text;
BEGIN
  n := replace(d, $a$FROM leads l
     WHERE (_toon_test OR NOT l.is_test)$a$, $a$FROM leads l
     WHERE (_toon_test OR NOT l.is_test) AND NOT public.lead_vlag_geparkeerd(l.vlag, l.vlag_datum, vandaag)$a$);
  n := replace(n, $a$  RETURN r || jsonb_build_object(
    'voornaam'$a$, $a$  -- Gemarkeerde personen waarvan de opvolgdatum vandaag of eerder is
  WITH b AS (
    SELECT l.* FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.vlag IS NOT NULL AND l.vlag_datum IS NOT NULL AND l.vlag_datum <= vandaag
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', vlag_datum, 'reden', CASE WHEN vlag='later' THEN 'Vandaag opvolgen: ' ELSE 'Actie nodig: ' END || coalesce(vlag_notitie,''), 'eigen', assigned_to = me) x, vlag_datum sinds
      FROM b ORDER BY vlag_datum LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('vlaggen', c);

  RETURN r || jsonb_build_object(
    'voornaam'$a$);
  n := replace(n, $a$'starter','einddatum_controle']$a$, $a$'starter','einddatum_controle','vlaggen']$a$);
  IF position($a$'vlaggen', c$a$ in n) = 0 OR position($a$'vlaggen']$a$ in n) = 0 OR position('lead_vlag_geparkeerd' in n) = 0 THEN RAISE EXCEPTION 'mijn_acties_vandaag niet aangepast'; END IF;
  EXECUTE n;
END $do$;