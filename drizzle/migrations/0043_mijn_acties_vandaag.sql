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

  -- 1. Nieuwe aanvragen en leads te behandelen
  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l
     WHERE (_toon_test OR NOT l.is_test)
       AND (l.status IN ('nieuw','nieuw_te_beoordelen') OR (coalesce(l.vereist_handmatige_beoordeling,false) AND l.geactiveerd_op IS NULL AND l.status NOT IN ('afgewezen','opgezegd')))
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

  -- 2. Aanvragen klaar om te activeren (buiten categorie 1)
  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l
     WHERE (_toon_test OR NOT l.is_test) AND l.type = 'verzekering_aanvraag' AND l.geactiveerd_op IS NULL
       AND l.status NOT IN ('afgewezen','opgezegd','nieuw','nieuw_te_beoordelen') AND NOT coalesce(l.vereist_handmatige_beoordeling,false)
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', created_at, 'reden', 'Nog niet geactiveerd', 'eigen', assigned_to = me) x, prio, created_at sinds
      FROM b ORDER BY prio, created_at LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('activeren', c);

  -- 3. Service-aanvragen open
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

  -- 4. Screening-aanvragen open
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

  -- 5. Terugbelverzoeken uit Chat Zeker (sessie met lead, lead nog niet opgepakt)
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

  -- 6. Afgehaakte aanvragen afgelopen 2 dagen
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

  -- 7. Polissen die binnen 30 dagen eindigen + pauzes rond de 90-dagenherinnering
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

  -- 8. Exact-fouten op leads
  WITH b AS (
    SELECT l.*, CASE WHEN l.assigned_to = me THEN 0 WHEN l.assigned_to IS NULL THEN 1 ELSE 2 END prio
      FROM leads l WHERE (_toon_test OR NOT l.is_test) AND nullif(trim(coalesce(l.exact_fout,'')),'') IS NOT NULL
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY prio, sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', trim(coalesce(voornaam,'')||' '||coalesce(achternaam,'')), 'bedrijfsnaam', bedrijfsnaam,
        'sinds', coalesce(exact_sync_op, created_at), 'reden', left(exact_fout, 80), 'eigen', assigned_to = me) x, prio, coalesce(exact_sync_op, created_at) sinds
      FROM b ORDER BY prio, coalesce(exact_sync_op, created_at) LIMIT 5) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('exact', c);

  RETURN r || jsonb_build_object(
    'voornaam', (SELECT split_part(coalesce(nullif(trim(full_name),''), ''), ' ', 1) FROM profiles WHERE id = me),
    'toon_test', _toon_test,
    'totaal', (SELECT sum((r->k->>'aantal')::int) FROM unnest(ARRAY['nieuw','activeren','service','screening','chat','afgehaakt','polissen','exact']) k));
END $function$;

REVOKE ALL ON FUNCTION public.mijn_acties_vandaag(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_acties_vandaag(boolean) TO authenticated, service_role;