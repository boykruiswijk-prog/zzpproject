-- 4. Opzegregels koppelen in plaats van dubbel tonen
ALTER TABLE public.klant_service_aanvragen ADD COLUMN IF NOT EXISTS gekoppeld_aan uuid REFERENCES public.klant_service_aanvragen(id);
COMMENT ON COLUMN public.klant_service_aanvragen.gekoppeld_aan IS 'Regel is samengevoegd met deze (hoofd)regel; niet apart tonen, nooit verwijderen.';
UPDATE public.klant_service_aanvragen SET gekoppeld_aan = '719f3202-d493-493e-ae0f-dafe10caaeed' WHERE id = '362d6d18-98b8-418f-a71b-7e03500752c5' AND gekoppeld_aan IS NULL;
UPDATE public.klant_service_aanvragen SET details = coalesce(details,'{}'::jsonb) || jsonb_build_object('verwerkt_einddatum','2026-07-08','verwerkt_door_naam','Ellen Baars','verwerkt_op_datum','2026-10-06','samengevoegd_regel','362d6d18-98b8-418f-a71b-7e03500752c5')
 WHERE id = '719f3202-d493-493e-ae0f-dafe10caaeed' AND NOT (coalesce(details,'{}'::jsonb) ? 'verwerkt_einddatum');
INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door_rol, details)
VALUES ('klant_service_aanvragen','362d6d18-98b8-418f-a71b-7e03500752c5','samengevoegd','gekoppeld_aan',NULL,'719f3202-d493-493e-ae0f-dafe10caaeed','systeem', jsonb_build_object('reden','dubbele opzegregel Peschier, op verzoek Boy'));

DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.crm_beeindig'::regproc);
  n := regexp_replace(d, 'INSERT INTO public\.klant_service_aanvragen \(type.*?RETURNING id INTO v_aid;',
$r$SELECT id INTO v_aid FROM public.klant_service_aanvragen
      WHERE type = 'opzeggen' AND onderneming_id = o.id AND gekoppeld_aan IS NULL
        AND (opzegging_verwerkt_op IS NULL OR created_at >= now() - interval '60 days')
      ORDER BY created_at LIMIT 1;
    IF v_aid IS NOT NULL THEN
      UPDATE public.klant_service_aanvragen SET details = coalesce(details,'{}'::jsonb) || jsonb_build_object('verwerkt_einddatum', _einddatum, 'verwerkt_reden', _reden, 'verwerkt_reden_label', v_label, 'verwerkt_toelichting', _toelichting, 'verwerkt_via', 'beheer_handmatig',
        'verwerkt_door_naam', (SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'verwerkt_op_datum', (now() AT TIME ZONE 'Europe/Amsterdam')::date)
       WHERE id = v_aid;
    ELSE
      INSERT INTO public.klant_service_aanvragen (type, voornaam, achternaam, email, telefoon, polisnummer, details, status, onderneming_id, is_test, geverifieerd)
      VALUES ('opzeggen', coalesce(p.voornaam,''), coalesce(p.achternaam,''), coalesce(p.email_weergave,''), '', '',
        jsonb_build_object('opzegdatum', _einddatum, 'bron', 'beheer_handmatig', 'reden', _reden, 'reden_label', v_label, 'toelichting', _toelichting, 'bedrijfsnaam', o.naam),
        'in_behandeling', o.id, o.is_test, true)
      RETURNING id INTO v_aid;
    END IF;$r$);
  IF n = d THEN RAISE EXCEPTION 'crm_beeindig: INSERT niet gevonden'; END IF;
  EXECUTE n;
END $do$;

-- Taakverdeling (wie doet facturatie) en taken
CREATE TABLE public.team_taakverdeling (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  facturatie boolean NOT NULL DEFAULT false,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_taakverdeling TO authenticated;
GRANT ALL ON public.team_taakverdeling TO service_role;
ALTER TABLE public.team_taakverdeling ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest taakverdeling" ON public.team_taakverdeling FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
INSERT INTO public.team_taakverdeling (user_id, facturatie) SELECT id, true FROM public.profiles WHERE id = '41555db2-7f32-4676-81dd-479b6b811a90' ON CONFLICT DO NOTHING;

CREATE TABLE public.crm_taken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soort text NOT NULL CHECK (soort IN ('exact_aanpassen')),
  onderneming_id uuid REFERENCES public.ondernemingen(id),
  persoon_id uuid REFERENCES public.personen(id),
  omschrijving text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','afgerond')),
  aangemaakt_door uuid, aangemaakt_door_naam text, aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  afgerond_door uuid, afgerond_op timestamptz,
  is_test boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.crm_taken TO authenticated;
GRANT ALL ON public.crm_taken TO service_role;
ALTER TABLE public.crm_taken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest taken" ON public.crm_taken FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_taak_afronden(_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  UPDATE public.crm_taken SET status = 'afgerond', afgerond_door = auth.uid(), afgerond_op = now() WHERE id = _id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'taak niet gevonden of al afgerond'; END IF;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
  VALUES ('crm_taken', _id, 'afgerond', 'status', 'open', 'afgerond', auth.uid(), public.get_user_role_label(auth.uid()));
  RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.crm_taak_afronden(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_taak_afronden(uuid) TO authenticated;

-- 5. Adres en telefoon
ALTER TABLE public.ondernemingen ADD COLUMN IF NOT EXISTS straat text, ADD COLUMN IF NOT EXISTS huisnummer text, ADD COLUMN IF NOT EXISTS postcode text, ADD COLUMN IF NOT EXISTS plaats text;
ALTER TABLE public.personen ADD COLUMN IF NOT EXISTS telefoon text;

CREATE OR REPLACE FUNCTION public.crm_gegevens_wijzigen(_onderneming_id uuid, _persoon_id uuid, _wijzigingen jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE o public.ondernemingen; p public.personen; k text; v text; oud text; regels text := ''; exact_velden text[] := '{}'; n int := 0;
  v_naam text; v_test boolean := false; mask text;
  ond_velden text[] := ARRAY['naam','kvk','rechtsvorm','straat','huisnummer','postcode','plaats','iban'];
  pers_velden text[] := ARRAY['voornaam','achternaam','email_weergave','telefoon'];
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) OR public.has_role(auth.uid(),'medewerker') AND NOT (public.has_role(auth.uid(),'verzekering') OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _wijzigingen IS NULL OR jsonb_typeof(_wijzigingen) <> 'object' THEN RAISE EXCEPTION 'geen wijzigingen'; END IF;
  SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
  IF _onderneming_id IS NOT NULL THEN SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id FOR UPDATE; IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF; v_test := o.is_test; END IF;
  IF _persoon_id IS NOT NULL THEN SELECT * INTO p FROM public.personen WHERE id = _persoon_id FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'persoon niet gevonden'; END IF; v_test := v_test OR p.is_test; END IF;
  FOR k, v IN SELECT key, nullif(btrim(value #>> '{}'),'') FROM jsonb_each(_wijzigingen) LOOP
    IF k = 'iban' THEN
      IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'IBAN wijzigen alleen supervisor of admin'; END IF;
      v := upper(replace(v,' ',''));
      IF v IS NOT NULL AND v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' THEN RAISE EXCEPTION 'ongeldig IBAN'; END IF;
    END IF;
    IF k = 'kvk' AND v IS NOT NULL AND v !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'KvK moet 8 cijfers zijn'; END IF;
    IF k = 'postcode' AND v IS NOT NULL THEN v := upper(regexp_replace(v,'\s','','g')); IF v !~ '^[1-9][0-9]{3}[A-Z]{2}$' THEN RAISE EXCEPTION 'ongeldige postcode'; END IF; v := substr(v,1,4)||' '||substr(v,5,2); END IF;
    IF k = 'email_weergave' AND v IS NOT NULL AND v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'ongeldig e-mailadres'; END IF;
    IF length(coalesce(v,'')) > 200 THEN RAISE EXCEPTION 'waarde te lang'; END IF;
    IF k = ANY(ond_velden) THEN
      IF o.id IS NULL THEN RAISE EXCEPTION 'geen onderneming gekozen'; END IF;
      EXECUTE format('SELECT ($1).%I::text', k) INTO oud USING o;
      IF oud IS DISTINCT FROM v THEN
        EXECUTE format('UPDATE public.ondernemingen SET %I = $1, updated_at = now() WHERE id = $2', k) USING v, o.id;
        mask := CASE WHEN k = 'iban' THEN coalesce(left(oud,4)||'****'||right(oud,4),'-') || ' -> ' || coalesce(left(v,4)||'****'||right(v,4),'-') ELSE coalesce(oud,'-')||' -> '||coalesce(v,'-') END;
        INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
        VALUES ('ondernemingen', o.id, 'gegevens_gewijzigd', k, oud, v, auth.uid(), public.get_user_role_label(auth.uid()));
        regels := regels || E'\n- ' || k || ': ' || mask; n := n + 1;
        IF k IN ('naam','straat','huisnummer','postcode','plaats','iban') THEN exact_velden := exact_velden || k; END IF;
      END IF;
    ELSIF k = ANY(pers_velden) THEN
      IF p.id IS NULL THEN RAISE EXCEPTION 'geen persoon gekozen'; END IF;
      EXECUTE format('SELECT ($1).%I::text', k) INTO oud USING p;
      IF oud IS DISTINCT FROM v THEN
        IF k = 'email_weergave' THEN
          IF v IS NULL THEN RAISE EXCEPTION 'e-mailadres mag niet leeg'; END IF;
          UPDATE public.personen SET email_weergave = v, genormaliseerd_email = lower(v), updated_at = now() WHERE id = p.id;
        ELSE
          EXECUTE format('UPDATE public.personen SET %I = $1, updated_at = now() WHERE id = $2', k) USING v, p.id;
        END IF;
        INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
        VALUES ('personen', p.id, 'gegevens_gewijzigd', k, oud, v, auth.uid(), public.get_user_role_label(auth.uid()));
        regels := regels || E'\n- ' || k || ': ' || coalesce(oud,'-') || ' -> ' || coalesce(v,'-'); n := n + 1;
        IF k IN ('voornaam','achternaam') THEN exact_velden := exact_velden || k; END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'onbekend veld %', k;
    END IF;
  END LOOP;
  IF n = 0 THEN RETURN jsonb_build_object('gewijzigd', 0); END IF;
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
  VALUES (o.id, p.id, 'overig', 'Gegevens gewijzigd door ' || coalesce(v_naam,'teamlid') || ':' || regels, auth.uid(), coalesce(v_naam,'teamlid'), v_test, jsonb_build_object('soort','gegevenswijziging'));
  IF array_length(exact_velden,1) > 0 THEN
    INSERT INTO public.crm_taken (soort, onderneming_id, persoon_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
    VALUES ('exact_aanpassen', o.id, p.id, 'Ook in Exact aanpassen: ' || array_to_string(exact_velden, ', ') || coalesce(' (' || o.naam || coalesce(', relatie ' || o.exact_relatie_code, '') || ')', ''),
      jsonb_build_object('velden', exact_velden), auth.uid(), coalesce(v_naam,'teamlid'), v_test);
  END IF;
  RETURN jsonb_build_object('gewijzigd', n, 'exact_taak', array_length(exact_velden,1) > 0);
END $f$;
REVOKE ALL ON FUNCTION public.crm_gegevens_wijzigen(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_gegevens_wijzigen(uuid, uuid, jsonb) TO authenticated;

-- 1. Facturatie-categorie in Vandaag te doen (alleen facturatiemedewerker en admin)
DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  n := replace(d, $a$  RETURN r || jsonb_build_object($a$, $a$  -- 9. Facturatie (Roxy): facturen die in Exact klaarstaan en Exact-aanpassingen
  IF public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie) THEN
    WITH b AS (
      SELECT l.id, trim(coalesce(l.voornaam,'')||' '||coalesce(l.achternaam,'')) naam, l.bedrijfsnaam, coalesce(l.exact_invoice_created_at, l.created_at) sinds,
             'Factuur staat klaar in Exact, wacht op verwerking' reden, 'lead' bron
        FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.exact_invoice_id IS NOT NULL AND l.exact_invoice_number IS NULL AND coalesce(l.exact_invoice_status,0) <> 50
      UNION ALL
      SELECT t.onderneming_id, coalesce(o.naam,''), o.naam, t.aangemaakt_op, t.omschrijving, 'taak'
        FROM crm_taken t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id
       WHERE t.status = 'open' AND (_toon_test OR NOT t.is_test)
    )
    SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'bedrijfsnaam', bedrijfsnaam, 'sinds', sinds, 'reden', reden, 'bron', bron) ORDER BY sinds) FROM (SELECT * FROM b ORDER BY sinds LIMIT 10) s), '[]'::jsonb)) INTO c;
  ELSE
    c := jsonb_build_object('aantal', 0, 'items', '[]'::jsonb, 'verborgen', true);
  END IF;
  r := r || jsonb_build_object('facturatie', c);

  RETURN r || jsonb_build_object($a$);
  n := replace(n, $a$'polissen','exact']$a$, $a$'polissen','exact','facturatie']$a$);
  IF n = d OR position('facturatie'']' in n) = 0 THEN RAISE EXCEPTION 'mijn_acties_vandaag: vervanging mislukt'; END IF;
  EXECUTE n;
END $do$;

-- 6. Menutellers (alleen status, geen testdata)
CREATE OR REPLACE FUNCTION public.menu_tellers() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE me uuid := auth.uid(); fact boolean;
BEGIN
  IF NOT public.is_team_member(me) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  fact := public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie);
  RETURN jsonb_build_object(
    'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag' AND geactiveerd_op IS NULL AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland','offerte_verstuurd')),
    'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag' AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland')),
    'service', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd') AND NOT (type = 'opzeggen' AND opzegging_verwerkt_op IS NOT NULL)),
    'screening', (SELECT count(*) FROM screening_aanvragen WHERE NOT is_test AND coalesce(status,'nieuw') NOT IN ('afgerond','afgewezen','geannuleerd')),
    'afgehaakt', (SELECT count(*) FROM aanvraag_concepten WHERE NOT is_test AND status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL AND laatst_actief_op >= now() - interval '7 days' AND laatst_actief_op < now() - interval '30 minutes'),
    'chat', (SELECT count(*) FROM chat_sessions s JOIN leads l ON l.id = s.lead_id WHERE NOT s.is_test AND NOT l.is_test AND l.status IN ('nieuw','nieuw_te_beoordelen')),
    'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')),
    'facturatie', CASE WHEN fact THEN
      (SELECT count(*) FROM leads WHERE NOT is_test AND exact_invoice_id IS NOT NULL AND exact_invoice_number IS NULL AND coalesce(exact_invoice_status,0) <> 50)
      + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open') ELSE 0 END
  );
END $f$;
REVOKE ALL ON FUNCTION public.menu_tellers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.menu_tellers() TO authenticated;

-- Factuurnummer meenemen bij lees-sync is code; offerte-log
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offerte_verstuurd_op timestamptz;