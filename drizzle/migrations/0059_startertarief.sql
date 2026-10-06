-- Startertarief BAV + AVB: eerste 12 maanden afwijkend bedrag, daarna automatisch het gewone bedrag.
ALTER TABLE public.klant_contracten
  ADD COLUMN IF NOT EXISTS tarief_type text NOT NULL DEFAULT 'standaard',
  ADD COLUMN IF NOT EXISTS starter_tot date,
  ADD COLUMN IF NOT EXISTS bedrag_na_starter numeric;
ALTER TABLE public.klant_contracten ADD CONSTRAINT klant_contracten_tarief_type_chk
  CHECK (tarief_type IN ('standaard','starter') AND (tarief_type = 'standaard' OR (starter_tot IS NOT NULL AND bedrag_na_starter IS NOT NULL AND bedrag_na_starter > 0)));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS kvk_startdatum date,
  ADD COLUMN IF NOT EXISTS tarief_type text NOT NULL DEFAULT 'standaard',
  ADD COLUMN IF NOT EXISTS starter_tot date,
  ADD COLUMN IF NOT EXISTS starter_controle_status text,
  ADD COLUMN IF NOT EXISTS starter_beoordeeld_door uuid,
  ADD COLUMN IF NOT EXISTS starter_beoordeeld_op timestamptz,
  ADD COLUMN IF NOT EXISTS starter_toelichting text;
ALTER TABLE public.leads ADD CONSTRAINT leads_tarief_type_chk CHECK (tarief_type IN ('standaard','starter'));
ALTER TABLE public.leads ADD CONSTRAINT leads_starter_status_chk CHECK (starter_controle_status IS NULL OR starter_controle_status IN ('te_controleren','goedgekeurd','afgewezen'));

ALTER TABLE public.bav_aanmeldingen
  ADD COLUMN IF NOT EXISTS kvk_startdatum date,
  ADD COLUMN IF NOT EXISTS tarief_type text NOT NULL DEFAULT 'standaard',
  ADD COLUMN IF NOT EXISTS starter_tot date;

CREATE OR REPLACE FUNCTION public.contract_bedrag_voor_periode(_tarief text, _starter_tot date, _bedrag numeric, _na numeric, _periode_start date)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _tarief = 'starter' AND _starter_tot IS NOT NULL AND _na IS NOT NULL AND _periode_start > _starter_tot THEN _na ELSE _bedrag END
$$;

CREATE OR REPLACE FUNCTION public.guard_lead_starter() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' OR current_setting('zp.starter_rpc', true) = '1' OR current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
  IF NEW.tarief_type IS DISTINCT FROM OLD.tarief_type OR NEW.starter_tot IS DISTINCT FROM OLD.starter_tot
     OR NEW.starter_controle_status IS DISTINCT FROM OLD.starter_controle_status OR NEW.kvk_startdatum IS DISTINCT FROM OLD.kvk_startdatum
     OR NEW.starter_beoordeeld_door IS DISTINCT FROM OLD.starter_beoordeeld_door OR NEW.starter_beoordeeld_op IS DISTINCT FROM OLD.starter_beoordeeld_op THEN
    RAISE EXCEPTION 'Startertarief wijzigen kan alleen via Startertarief controleren';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_lead_starter BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_lead_starter();

CREATE OR REPLACE FUNCTION public.beoordeel_startertarief(_lead_id uuid, _goedkeuren boolean, _toelichting text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; nieuw text;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  IF l.starter_controle_status IS DISTINCT FROM 'te_controleren' THEN RAISE EXCEPTION 'startertarief is al beoordeeld of niet aangevraagd'; END IF;
  IF l.geactiveerd_op IS NOT NULL THEN RAISE EXCEPTION 'aanvraag is al geactiveerd'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting te lang'; END IF;
  nieuw := CASE WHEN _goedkeuren THEN 'goedgekeurd' ELSE 'afgewezen' END;
  PERFORM set_config('zp.starter_rpc', '1', true);
  UPDATE public.leads SET starter_controle_status = nieuw,
    tarief_type = CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END,
    starter_tot = CASE WHEN _goedkeuren THEN starter_tot ELSE NULL END,
    starter_beoordeeld_door = auth.uid(), starter_beoordeeld_op = now(), starter_toelichting = nullif(trim(_toelichting),'')
  WHERE id = _lead_id;
  UPDATE public.bav_aanmeldingen SET tarief_type = CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END,
    starter_tot = CASE WHEN _goedkeuren THEN starter_tot ELSE NULL END WHERE lead_id = _lead_id;
  PERFORM set_config('zp.starter_rpc', '0', true);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
  VALUES ('leads', _lead_id, 'startertarief_beoordeeld', 'starter_controle_status', 'te_controleren', nieuw, auth.uid(), public.get_user_role_label(auth.uid()));
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, is_test)
  VALUES ('startertarief_' || nieuw,
    'Startertarief ' || nieuw || ' (KVK-startdatum ' || coalesce(to_char(l.kvk_startdatum,'DD-MM-YYYY'),'onbekend') || ')' || coalesce(': ' || nullif(trim(_toelichting),''), ''),
    auth.uid(), (SELECT full_name FROM public.profiles WHERE id = auth.uid()), _lead_id, l.is_test);
  RETURN jsonb_build_object('status', nieuw, 'tarief_type', CASE WHEN _goedkeuren THEN 'starter' ELSE 'standaard' END);
END $$;
REVOKE ALL ON FUNCTION public.beoordeel_startertarief(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.beoordeel_startertarief(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.contract_bedrag_voor_periode(text, date, numeric, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_bedrag_voor_periode(text, date, numeric, numeric, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.facturatie_kandidaten(_van date, _tot date)
 RETURNS TABLE(klant_contract_id uuid, onderneming_id uuid, relatiecode text, klantnaam text, itemcode text, product text, cyclus text, periode_start date, periode_eind date, aantal numeric, bedrag_per_periode numeric, bedrag numeric, exact_account_id text, exact_item_id text, gl_code text, achterstallig boolean, blokkade text, blokkade_soort text, bestaande_planning_status text, btw_code text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_supervisor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  IF _tot < _van OR _tot - _van > 400 THEN RAISE EXCEPTION 'ongeldig bereik'; END IF;
  RETURN QUERY
  WITH c AS (
    SELECT k.*, o.exact_relatie_code AS rc, coalesce(o.exact_account_naam, o.naam) AS nm, o.exact_account_id AS acc,
           o.exact_koppeling_status AS ks, o.facturatie_blokkade AS ob, o.facturatie_blokkade_reden AS obr,
           public.factuur_mapping_voor(k.itemcode) AS m
    FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
    WHERE k.status IN ('actief','loopt_af') AND NOT k.is_test AND NOT o.is_test AND k.volgende_factuurdatum IS NOT NULL
  ), p AS (
    SELECT c.*, public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n) AS ps,
           public.contract_bedrag_voor_periode(c.tarief_type, c.starter_tot, c.bedrag_per_periode, c.bedrag_na_starter, public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n)) AS bpp
    FROM c, generate_series(0, 500) n
    WHERE public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n) <= _tot
  )
  SELECT p.id, p.onderneming_id, p.rc, p.nm, p.itemcode, p.product, p.cyclus, p.ps,
         public.factuur_periode_eind(p.ps, p.cyclus), p.aantal, p.bpp,
         round(p.bpp * p.aantal, 2), p.acc, (p.m).exact_item_id, (p.m).gl_code,
         p.ps < _van,
         CASE
           WHEN p.ob IS NOT NULL THEN coalesce(p.obr, p.ob)
           WHEN p.acc IS NULL THEN 'geen Exact-koppeling (relatie niet gevonden)'
           WHEN p.eind_datum IS NOT NULL AND p.ps > p.eind_datum THEN 'na einddatum contract'
           WHEN round(p.bpp * p.aantal, 2) <= 0 THEN 'bedrag nul of negatief'
           WHEN (p.m).id IS NULL THEN 'geen artikelmapping (' || p.itemcode || ')'
           WHEN (p.m).blokkade_reden IS NOT NULL THEN (p.m).blokkade_reden
           WHEN (p.m).exact_item_id IS NULL THEN 'artikel ontbreekt in Exact (' || p.itemcode || ')'
           WHEN NOT (p.m).bevestigd THEN 'artikelmapping nog niet bevestigd'
           WHEN ((p.m).gl_code = '8004' AND coalesce((p.m).btw_code,'0') = '0') OR ((p.m).gl_code = '8003' AND coalesce((p.m).btw_code,'0') <> '0') THEN 'BTW-code past niet bij grootboek'
           WHEN fp.status IS NOT NULL THEN 'periode al gepland (' || fp.status || ')'
         END,
         CASE
           WHEN p.ob IS NOT NULL THEN 'conflict'
           WHEN p.acc IS NULL THEN 'relatie'
           WHEN p.eind_datum IS NOT NULL AND p.ps > p.eind_datum THEN 'einddatum'
           WHEN round(p.bpp * p.aantal, 2) <= 0 THEN 'bedrag'
           WHEN (p.m).id IS NULL OR (p.m).blokkade_reden IS NOT NULL OR (p.m).exact_item_id IS NULL THEN 'artikel'
           WHEN NOT (p.m).bevestigd THEN 'mapping'
           WHEN ((p.m).gl_code = '8004' AND coalesce((p.m).btw_code,'0') = '0') OR ((p.m).gl_code = '8003' AND coalesce((p.m).btw_code,'0') <> '0') THEN 'btw'
           WHEN fp.status IS NOT NULL THEN 'bezet'
         END,
         fp.status,
         coalesce((p.m).btw_code, '0')
  FROM p LEFT JOIN public.factuur_planning fp
    ON fp.klant_contract_id = p.id AND fp.periode_start = p.ps AND fp.status <> 'vervangen'
  ORDER BY p.ps, p.rc;
END $function$;

CREATE OR REPLACE FUNCTION public.mijn_acties_vandaag(_toon_test boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  vandaag date;
  r jsonb := '{}'::jsonb;
  c jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _toon_test AND NOT public.is_supervisor_or_admin(auth.uid()) THEN _toon_test := false; END IF;
  vandaag := (now() AT TIME ZONE 'Europe/Amsterdam')::date;

  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l
     WHERE (_toon_test OR NOT l.is_test)
       AND (l.status IN ('nieuw','nieuw_te_beoordelen') OR (coalesce(l.vereist_handmatige_beoordeling,false) AND l.geactiveerd_op IS NULL AND l.status NOT IN ('afgewezen','opgezegd','afgerond')))
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'handmatig', (SELECT count(*) FROM b WHERE coalesce(vereist_handmatige_beoordeling,false)),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', created_at, 'reden', CASE WHEN coalesce(vereist_handmatige_beoordeling,false) THEN 'Handmatige acceptatie (zorg/bouw)'
          WHEN type = 'verzekering_aanvraag' THEN 'Nieuwe aanvraag' WHEN type = 'offerte-aanvraag' THEN 'Offerteaanvraag' ELSE 'Contactverzoek' END,
        'eigen', assigned_to = me) x, prio, created_at sinds
      FROM b ORDER BY prio, created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('nieuw', c);

  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l
     WHERE (_toon_test OR NOT l.is_test) AND l.type = 'verzekering_aanvraag' AND l.geactiveerd_op IS NULL
       AND l.status NOT IN ('afgewezen','opgezegd','nieuw','nieuw_te_beoordelen','afgerond') AND NOT coalesce(l.vereist_handmatige_beoordeling,false)
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', created_at, 'reden', 'Nog niet geactiveerd', 'eigen', assigned_to = me) x, prio, created_at sinds
      FROM b ORDER BY prio, created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('activeren', c);

  WITH b AS (
    SELECT * FROM klant_service_aanvragen
     WHERE (_toon_test OR NOT is_test)
       AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')
       AND NOT (type = 'opzeggen' AND opzegging_verwerkt_op IS NOT NULL)
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'per_type', coalesce((SELECT jsonb_object_agg(type, n) FROM (SELECT type, count(*) n FROM b GROUP BY type) t), '{}'::jsonb),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', details->>'bedrijfsnaam',
        'sinds', created_at, 'reden', initcap(type)) x, created_at sinds
      FROM b ORDER BY created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('service', c);

  WITH b AS (
    SELECT * FROM screening_aanvragen
     WHERE (_toon_test OR NOT is_test) AND coalesce(status,'nieuw') NOT IN ('afgerond','afgewezen','geannuleerd')
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', aangemeld_op, 'reden', coalesce(screening_type, 'Screening')||' ('||coalesce(status,'nieuw')||')') x, aangemeld_op sinds
      FROM b ORDER BY aangemeld_op LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('screening', c);

  WITH b AS (
    SELECT s.id sessie_id, l.id lead_id, l.voornaam, l.achternaam, l.bedrijfsnaam, s.created_at,
           CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM chat_sessions s JOIN leads l ON l.id = s.lead_id
     WHERE (_toon_test OR (NOT s.is_test AND NOT l.is_test)) AND l.status IN ('nieuw','nieuw_te_beoordelen')
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', lead_id, 'sessie_id', sessie_id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', created_at, 'reden', 'Terugbelverzoek via chat') x, prio, created_at sinds
      FROM b ORDER BY prio, created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('chat', c);

  WITH b AS (
    SELECT * FROM aanvraag_concepten
     WHERE (_toon_test OR NOT is_test) AND status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL
       AND laatst_actief_op >= now() - interval '2 days' AND laatst_actief_op < now() - interval '30 minutes'
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', laatst_actief_op, 'reden', 'Gestopt bij stap '||coalesce(stap,1)) x, laatst_actief_op sinds
      FROM b ORDER BY laatst_actief_op LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('afgehaakt', c);

  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio,
      CASE WHEN l.polis_einddatum IS NOT NULL AND l.polis_einddatum BETWEEN vandaag AND vandaag + 30 THEN 'Polis eindigt '||to_char(l.polis_einddatum,'DD-MM-YYYY')
           WHEN l.pauze_reminder_verzonden_op IS NOT NULL THEN 'Gepauzeerd, herinnering verstuurd'
           ELSE 'Pauze bereikt binnenkort 90 dagen' END reden,
      coalesce(CASE WHEN l.polis_einddatum BETWEEN vandaag AND vandaag + 30 THEN l.polis_einddatum::timestamptz END, l.pauze_start_datum::timestamptz) sinds
      FROM leads l
     WHERE (_toon_test OR NOT l.is_test)
       AND ((l.polis_einddatum BETWEEN vandaag AND vandaag + 30 AND l.status IN ('actief','klant','gepauzeerd'))
         OR (l.status = 'gepauzeerd' AND (l.pauze_reminder_verzonden_op IS NOT NULL OR l.pauze_start_datum <= vandaag - 83)))
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', sinds, 'reden', reden, 'eigen', assigned_to = me) x, prio, sinds
      FROM b ORDER BY prio, sinds LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('polissen', c);

  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.status <> 'afgerond' AND nullif(trim(coalesce(l.exact_fout,'')),'') IS NOT NULL
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', coalesce(exact_sync_op, created_at), 'reden', left(exact_fout, 80), 'eigen', assigned_to = me) x, prio, coalesce(exact_sync_op, created_at) sinds
      FROM b ORDER BY prio, coalesce(exact_sync_op, created_at) LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('exact', c);

  IF public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie) THEN
    WITH b AS (
      SELECT l.id, trim(coalesce(l.voornaam,'')||' '||coalesce(l.achternaam,'')) naam, l.bedrijfsnaam, coalesce(l.exact_invoice_created_at, l.created_at) sinds,
             'Factuur staat klaar in Exact, wacht op verwerking' reden, 'lead' bron
        FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.exact_invoice_id IS NOT NULL AND l.exact_invoice_number IS NULL AND coalesce(l.exact_invoice_status,0) <> 50
      UNION ALL
      SELECT t.onderneming_id, coalesce(o.naam,''), o.naam, t.aangemaakt_op, t.omschrijving, 'taak'
        FROM crm_taken t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id
       WHERE t.status = 'open' AND t.soort = 'exact_aanpassen' AND (_toon_test OR NOT t.is_test)
    )
    SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'bedrijfsnaam', bedrijfsnaam, 'sinds', sinds, 'reden', reden, 'bron', bron) ORDER BY sinds) FROM (SELECT * FROM b ORDER BY sinds LIMIT 10) s), '[]'::jsonb)) INTO c;
  ELSE
    c := jsonb_build_object('aantal', 0, 'items', '[]'::jsonb, 'verborgen', true);
  END IF;
  r := r || jsonb_build_object('facturatie', c);
  WITH b AS (
    SELECT t.onderneming_id AS id, coalesce(o.naam,'') AS naam, o.naam AS bedrijfsnaam, t.aangemaakt_op AS sinds, t.omschrijving AS reden, 'taak'::text AS bron
      FROM crm_taken t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id
     WHERE t.status = 'open' AND t.soort = 'nieuwe_aanvraag_nodig' AND (_toon_test OR NOT t.is_test))
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'bedrijfsnaam', bedrijfsnaam, 'sinds', sinds, 'reden', reden, 'bron', bron) ORDER BY sinds) FROM (SELECT * FROM b ORDER BY sinds LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('nieuwe_aanvraag', c);

  -- Startertarief controleren (KVK-startdatum met de hand nakijken voor activatie)
  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.starter_controle_status = 'te_controleren' AND l.status NOT IN ('afgewezen','opgezegd','afgerond')
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', created_at, 'reden', 'Startertarief controleren (KVK-startdatum '||coalesce(to_char(kvk_startdatum,'DD-MM-YYYY'),'onbekend')||')', 'eigen', assigned_to = me) x, prio, created_at sinds
      FROM b ORDER BY prio, created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('starter', c);

  RETURN r || jsonb_build_object(
    'voornaam', (SELECT split_part(coalesce(nullif(trim(full_name),''), ''), ' ', 1) FROM profiles WHERE id = me),
    'toon_test', _toon_test,
    'totaal', (SELECT sum((r->k->>'aantal')::int) FROM unnest(ARRAY['nieuw','activeren','service','screening','chat','afgehaakt','polissen','exact','facturatie','starter']) k));
END $function$;