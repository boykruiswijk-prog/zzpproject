CREATE OR REPLACE FUNCTION public.menu_tellers()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); fact boolean;
BEGIN
  IF NOT public.is_team_member(me) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  fact := public.is_admin(me) OR EXISTS (SELECT 1 FROM team_taakverdeling WHERE user_id = me AND facturatie);
  RETURN jsonb_build_object(
    'aanvragen', (SELECT count(*) FROM leads WHERE NOT is_test AND type = 'verzekering_aanvraag' AND geactiveerd_op IS NULL AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland','offerte_verstuurd')),
    'leads', (SELECT count(*) FROM leads WHERE NOT is_test AND type <> 'verzekering_aanvraag' AND status IN ('nieuw','nieuw_te_beoordelen','in_behandeling','afspraak_gepland')),
    'service', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type NOT IN ('opzeggen','portaltoegang') AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'opzeggingen', (SELECT count(*) FROM klant_service_aanvragen WHERE NOT is_test AND gekoppeld_aan IS NULL AND type = 'opzeggen' AND opzegging_verwerkt_op IS NULL AND coalesce(status,'nieuw') NOT IN ('afgerond','behandeld','afgewezen','geannuleerd')),
    'screening', (SELECT count(*) FROM screening_aanvragen WHERE NOT is_test AND coalesce(status,'nieuw') NOT IN ('afgerond','afgewezen','geannuleerd')),
    'afgehaakt', (SELECT count(*) FROM aanvraag_concepten WHERE NOT is_test AND status = 'open' AND lead_id IS NULL AND geanonimiseerd_op IS NULL AND laatst_actief_op >= now() - interval '7 days' AND laatst_actief_op < now() - interval '30 minutes'),
    'chat', (SELECT count(*) FROM chat_sessions s JOIN leads l ON l.id = s.lead_id WHERE NOT s.is_test AND NOT l.is_test AND l.status IN ('nieuw','nieuw_te_beoordelen')),
    'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')) + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'nieuwe_aanvraag_nodig'),
    'facturatie', CASE WHEN fact THEN
      (SELECT count(*) FROM leads WHERE NOT is_test AND exact_invoice_id IS NOT NULL AND exact_invoice_number IS NULL AND coalesce(exact_invoice_status,0) <> 50)
      + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'exact_aanpassen') ELSE 0 END
  );
END $function$;

DO $m$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  IF position('type <> ''portaltoegang''' in d) = 0 THEN
    d := replace(d, E'AND NOT (type = ''opzeggen'' AND opzegging_verwerkt_op IS NOT NULL)\n  )',
                    E'AND NOT (type = ''opzeggen'' AND opzegging_verwerkt_op IS NOT NULL)\n       AND type <> ''portaltoegang''\n  )');
    IF position('type <> ''portaltoegang''' in d) = 0 THEN RAISE EXCEPTION 'mijn_acties_vandaag niet aangepast'; END IF;
    EXECUTE d;
  END IF;
END $m$;

CREATE OR REPLACE FUNCTION public.zoek_koppel_kandidaten(_aanvraag_id uuid, _zoek text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  a public.klant_service_aanvragen;
  tekst text; nums text[]; mail text; dom text; woorden text[]; namen text[]; met_test boolean;
  algemeen text[] := ARRAY['gmail.com','hotmail.com','outlook.com','live.nl','live.com','hotmail.nl','icloud.com','yahoo.com','ziggo.nl','kpnmail.nl','planet.nl','xs4all.nl','home.nl','me.com','msn.com','upcmail.nl','outlook.nl','gmail.nl'];
  res jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _aanvraag_id IS NOT NULL THEN SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id; END IF;
  met_test := coalesce(a.is_test, false);
  _zoek := nullif(btrim(coalesce(_zoek, '')), '');

  tekst := concat_ws(' ', a.polisnummer, a.details->>'debiteurnummer', a.details->>'relatiecode', a.details->>'kvk',
                     a.details->>'toelichting', a.details->>'opmerkingen', _zoek);
  nums := ARRAY(SELECT DISTINCT ltrim(m[1], '0') FROM regexp_matches(coalesce(tekst, ''), '(\d{4,})', 'g') m);

  mail := lower(btrim(coalesce((SELECT m[1] FROM regexp_matches(coalesce(_zoek, ''), '([^\s]+@[^\s]+)') m LIMIT 1), a.email, '')));
  mail := nullif(mail, '');
  dom := lower(coalesce(
    nullif(split_part(mail, '@', 2), ''),
    (SELECT m[1] FROM regexp_matches(coalesce(_zoek, ''), '(?:^|\s)@?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:\s|$)', 'i') m LIMIT 1)));
  IF dom = ANY(algemeen) THEN dom := NULL; END IF;

  woorden := ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(lower(regexp_replace(
               concat_ws(' ', a.voornaam, a.achternaam, a.details->>'bedrijfsnaam', regexp_replace(coalesce(_zoek, ''), '[^\s]+@[^\s]+', '', 'g')),
               '[^[:alpha:]\s]', ' ', 'g')), '\s+') w
             WHERE length(w) >= 3 AND w NOT IN ('vof','het','van','der','den','info','debiteurnummer','polisnummer','relatiecode','hcr','hpi'));
  namen := ARRAY(SELECT DISTINCT btrim(n) FROM unnest(ARRAY[lower(nullif(btrim(a.details->>'bedrijfsnaam'), '')),
               lower(regexp_replace(coalesce(_zoek, ''), '[^\s]+@[^\s]+|[\d]+', '', 'g'))]) n WHERE length(btrim(coalesce(n, ''))) >= 3);

  WITH s AS (
    SELECT o.id, 100 AS sc, 'Exact-relatiecode ' || o.exact_relatie_code || ' komt overeen (debiteurnummer)' AS r
      FROM ondernemingen o WHERE ltrim(o.exact_relatie_code, '0') = ANY(nums)
    UNION ALL
    SELECT b.onderneming_id, 90, 'BAV-nummer ' || b.nummer || ' komt overeen'
      FROM crm_bav_nummers b WHERE b.onderneming_id IS NOT NULL AND b.bron <> 'klant'
       AND ltrim(regexp_replace(b.nummer, '\D', '', 'g'), '0') = ANY(nums)
    UNION ALL
    SELECT o.id, 90, 'KVK-nummer komt overeen' FROM ondernemingen o WHERE o.kvk IS NOT NULL AND ltrim(o.kvk, '0') = ANY(nums)
    UNION ALL
    SELECT po.onderneming_id, 85, 'E-mailadres contactpersoon komt overeen'
      FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE mail IS NOT NULL AND p.genormaliseerd_email = mail
    UNION ALL
    SELECT o.id, 85, 'Factuur-e-mail komt overeen' FROM ondernemingen o WHERE mail IS NOT NULL AND lower(btrim(o.factuur_email)) = mail
    UNION ALL
    SELECT po.onderneming_id, 55, 'Zelfde e-maildomein (' || dom || ')'
      FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE dom IS NOT NULL AND p.genormaliseerd_email LIKE '%@' || dom
    UNION ALL
    SELECT o.id, 55, 'Zelfde e-maildomein (' || dom || ')' FROM ondernemingen o WHERE dom IS NOT NULL AND lower(o.factuur_email) LIKE '%@' || dom
    UNION ALL
    SELECT o.id, 45, 'Bedrijfsnaam lijkt op domein ' || dom
      FROM ondernemingen o WHERE dom IS NOT NULL AND similarity(lower(o.naam), split_part(dom, '.', 1)) >= 0.45
    UNION ALL
    SELECT o.id, (20 + round(40 * similarity(lower(o.naam), n)))::int, 'Bedrijfsnaam lijkt op "' || n || '"'
      FROM ondernemingen o, unnest(namen) n WHERE similarity(lower(o.naam), n) >= 0.35
    UNION ALL
    SELECT po.onderneming_id,
           CASE WHEN lower(p.achternaam) = w THEN 40 ELSE 25 END
             + CASE WHEN coalesce(a.voornaam, '') <> '' AND left(lower(coalesce(p.voornaam, '')), 1) = left(lower(a.voornaam), 1) THEN 5 ELSE 0 END,
           'Contactpersoon ' || btrim(concat_ws(' ', p.voornaam, p.achternaam)) || CASE WHEN lower(p.achternaam) = w THEN ' (zelfde achternaam)' ELSE ' (naam lijkt erop)' END
      FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id, unnest(woorden) w
     WHERE coalesce(p.achternaam, '') <> '' AND (lower(p.achternaam) = w OR similarity(lower(p.achternaam), w) >= 0.6)
    UNION ALL
    SELECT o.id, 35, 'Contactpersoon (AFAS) ' || o.afas_contactpersoon || ' lijkt erop'
      FROM ondernemingen o, unnest(woorden) w WHERE o.afas_contactpersoon ~* ('\m' || w || '\M')
    UNION ALL
    SELECT o.id, 30, 'Bedrijfsnaam bevat "' || w || '"'
      FROM ondernemingen o, unnest(woorden) w WHERE length(w) >= 4 AND lower(o.naam) ~ ('\m' || w || '\M')
  ), g AS (
    SELECT s.id, max(s.sc) + 5 * (count(DISTINCT s.r) - 1) AS score, array_agg(DISTINCT s.r) AS redenen, max(s.sc) AS top
      FROM s JOIN ondernemingen o ON o.id = s.id WHERE s.id IS NOT NULL AND (met_test OR NOT o.is_test)
     GROUP BY s.id ORDER BY 2 DESC LIMIT 10
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'onderneming_id', o.id, 'naam', o.naam, 'exact_relatie_code', o.exact_relatie_code, 'kvk', o.kvk,
    'score', LEAST(g.score, 100), 'redenen', to_jsonb(g.redenen),
    'contactpersoon', coalesce((SELECT string_agg(btrim(concat_ws(' ', p.voornaam, p.achternaam)), ', ') FROM persoon_onderneming po JOIN personen p ON p.id = po.persoon_id WHERE po.onderneming_id = o.id), o.afas_contactpersoon),
    'email', coalesce(o.factuur_email, (SELECT p.email_weergave FROM persoon_onderneming po JOIN personen p ON p.id = po.persoon_id WHERE po.onderneming_id = o.id LIMIT 1)),
    'bav_nummer', (SELECT b.nummer FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','afas') ORDER BY (b.bron = 'zp') DESC, b.datum DESC NULLS LAST LIMIT 1),
    'contract_status', (SELECT string_agg(DISTINCT k.status, ', ') FROM klant_contracten k WHERE k.onderneming_id = o.id)
  ) ORDER BY g.score DESC, g.top DESC, o.naam), '[]'::jsonb) INTO res
  FROM g JOIN ondernemingen o ON o.id = g.id;
  RETURN res;
END $function$;

REVOKE ALL ON FUNCTION public.zoek_koppel_kandidaten(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zoek_koppel_kandidaten(uuid, text) TO authenticated, service_role;