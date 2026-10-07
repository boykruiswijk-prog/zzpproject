CREATE OR REPLACE FUNCTION public.zoek_norm_tel(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN length(d) = 9 THEN d END FROM (
    SELECT CASE WHEN x LIKE '0031%' THEN substr(x, 5) WHEN x LIKE '31%' AND length(x) = 11 THEN substr(x, 3)
                WHEN x LIKE '0%' THEN substr(x, 2) ELSE x END AS d
      FROM (SELECT regexp_replace(coalesce(_t, ''), '\D', '', 'g') AS x) a) b
$$;

CREATE OR REPLACE FUNCTION public.zoek_masker_iban(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN length(c) >= 6 THEN left(c, 2) || '** **** **** **' || substr(right(c, 4), 1, 2) || ' ' || right(c, 2) END
    FROM (SELECT upper(regexp_replace(coalesce(_t, ''), '\s', '', 'g')) AS c) a
$$;

CREATE INDEX IF NOT EXISTS ondernemingen_naam_trgm ON public.ondernemingen USING gin (lower(naam) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS personen_naam_trgm ON public.personen USING gin (lower(coalesce(voornaam,'') || ' ' || coalesce(achternaam,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS personen_email_trgm ON public.personen USING gin (genormaliseerd_email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_naam_trgm ON public.leads USING gin (lower(coalesce(voornaam,'') || ' ' || coalesce(achternaam,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_bedrijfsnaam_trgm ON public.leads USING gin (lower(bedrijfsnaam) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_email_trgm ON public.leads USING gin (lower(email) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ksa_naam_trgm ON public.klant_service_aanvragen USING gin (lower(coalesce(voornaam,'') || ' ' || coalesce(achternaam,'')) extensions.gin_trgm_ops);

-- Universele beheerzoekfunctie. Alleen verzekering/supervisor/admin (met 2FA). IBAN alleen gemaskeerd terug; IBAN-zoekacties naar sensitive_audit_log.
CREATE OR REPLACE FUNCTION public.zoek_universeel(_zoek text, _met_test boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  ql text; qc text; dig text; nq text; mail text; dom text; tel9 text; ibanq text; ibansuf text; pc text; hnr text; ref text;
  cijfers boolean; nums text[]; woorden text[]; init text[]; domw text[]; m text[];
  algemeen text[] := ARRAY['gmail','hotmail','outlook','live','icloud','yahoo','ziggo','kpnmail','planet','xs4all','home','me','msn','upcmail','zpzaken'];
  stop text[] := ARRAY['vof','het','van','der','den','de','info','debiteurnummer','polisnummer','relatiecode','hcr','hpi','bv','b.v','www','com','nl'];
  res jsonb; n_iban int := 0;
BEGIN
  IF NOT (public.is_team_member(me) AND (public.has_role(me, 'verzekering') OR public.is_supervisor_or_admin(me))) THEN
    RAISE EXCEPTION 'geen toegang';
  END IF;
  _met_test := coalesce(_met_test, false) AND public.is_supervisor_or_admin(me);
  ql := lower(btrim(coalesce(_zoek, '')));
  IF length(ql) < 2 THEN RETURN jsonb_build_object('klanten','[]'::jsonb,'contracten','[]'::jsonb,'leads','[]'::jsonb,'opzeggingen','[]'::jsonb,'service','[]'::jsonb); END IF;
  ql := left(ql, 120);
  qc := regexp_replace(ql, '[^a-z0-9]', '', 'g');
  dig := regexp_replace(ql, '\D', '', 'g');
  cijfers := ql ~ '^[\d\s+()./-]+$';
  nums := ARRAY(SELECT DISTINCT ltrim(x[1], '0') FROM regexp_matches(ql, '(\d{4,})', 'g') x);
  IF cijfers AND length(dig) >= 4 THEN nums := array_append(nums, ltrim(dig, '0')); END IF;
  IF cijfers THEN tel9 := public.zoek_norm_tel(dig); END IF;
  IF qc ~ '^[a-z]{2}\d{2}[a-z]{4}\d{0,10}$' AND length(qc) >= 8 THEN ibanq := qc;
  ELSIF cijfers AND length(dig) BETWEEN 4 AND 10 THEN ibansuf := dig; END IF;
  mail := (SELECT x[1] FROM regexp_matches(ql, '([^\s]+@[^\s]+)') x LIMIT 1);
  dom := coalesce(nullif(split_part(mail, '@', 2), ''), (SELECT x[1] FROM regexp_matches(ql, '(?:^|\s)@?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:\s|$)') x LIMIT 1));
  nq := btrim(regexp_replace(regexp_replace(regexp_replace(ql, '[^\s]+@[^\s]+', '', 'g'), '[^[:alpha:]\s]', ' ', 'g'), '\s+', ' ', 'g'));
  woorden := ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(nq, ' ') w WHERE length(w) >= 3 AND w <> ALL(stop));
  init := ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(nq, ' ') w WHERE length(w) = 1);
  domw := ARRAY(SELECT DISTINCT x FROM unnest(woorden || split_part(dom, '.', 1)) x WHERE length(x) >= 4 AND x <> ALL(algemeen));
  m := regexp_match(ql, '(\d{4})\s*([a-z]{2})(?:\s+(\d+))?');
  IF m IS NOT NULL THEN pc := m[1] || upper(m[2]); hnr := m[3]; END IF;
  IF qc ~ '^[0-9a-f]{6,}$' AND qc ~ '[a-f]' THEN ref := qc; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _zk(id uuid, sc int, r text, iban boolean) ON COMMIT DROP; TRUNCATE _zk;
  CREATE TEMP TABLE IF NOT EXISTS _zl(id uuid, sc int, r text, iban boolean) ON COMMIT DROP; TRUNCATE _zl;
  CREATE TEMP TABLE IF NOT EXISTS _zs(id uuid, sc int, r text) ON COMMIT DROP; TRUNCATE _zs;

  -- Klanten
  INSERT INTO _zk
  SELECT o.id, 100, 'Exact-relatiecode ' || o.exact_relatie_code || ' komt overeen', false FROM ondernemingen o WHERE ltrim(o.exact_relatie_code, '0') = ANY(nums)
  UNION ALL SELECT b.onderneming_id, CASE WHEN b.bron = 'klant' THEN 70 ELSE 95 END, 'BAV-/polisnummer ' || b.nummer || ' komt overeen', false
    FROM crm_bav_nummers b WHERE b.onderneming_id IS NOT NULL AND ltrim(regexp_replace(b.nummer, '\D', '', 'g'), '0') = ANY(nums)
  UNION ALL SELECT o.id, 95, 'KVK-nummer ' || o.kvk || ' komt overeen', false FROM ondernemingen o WHERE ltrim(o.kvk, '0') = ANY(nums)
  UNION ALL SELECT o.id, CASE WHEN ibanq IS NOT NULL THEN 95 ELSE 60 END, 'IBAN ' || zoek_masker_iban(o.iban) || ' komt overeen', true
    FROM ondernemingen o WHERE o.iban IS NOT NULL AND ((ibanq IS NOT NULL AND lower(regexp_replace(o.iban, '\s', '', 'g')) LIKE ibanq || '%')
      OR (ibansuf IS NOT NULL AND regexp_replace(o.iban, '\s', '', 'g') ~ ('\d' || ibansuf || '$')))
  UNION ALL SELECT po.onderneming_id, 90, 'E-mailadres ' || p.genormaliseerd_email || ' komt overeen', false
    FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE mail IS NOT NULL AND p.genormaliseerd_email = mail
  UNION ALL SELECT o.id, 90, 'Factuur-e-mail komt overeen', false FROM ondernemingen o WHERE mail IS NOT NULL AND lower(btrim(o.factuur_email)) = mail
  UNION ALL SELECT po.onderneming_id, 60, 'E-maildomein ' || split_part(p.genormaliseerd_email, '@', 2) || ' past bij "' || w || '"', false
    FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id, unnest(domw) w
   WHERE split_part(split_part(p.genormaliseerd_email, '@', 2), '.', 1) <> ALL(algemeen)
     AND similarity(split_part(split_part(p.genormaliseerd_email, '@', 2), '.', 1), w) >= 0.6
  UNION ALL SELECT o.id, 60, 'E-maildomein ' || split_part(lower(o.factuur_email), '@', 2) || ' past bij "' || w || '"', false
    FROM ondernemingen o, unnest(domw) w
   WHERE split_part(split_part(lower(o.factuur_email), '@', 2), '.', 1) <> ALL(algemeen)
     AND similarity(split_part(split_part(lower(o.factuur_email), '@', 2), '.', 1), w) >= 0.6
  UNION ALL SELECT o.id, (30 + round(55 * similarity(lower(o.naam), nq)))::int, 'Bedrijfsnaam lijkt op "' || nq || '"', false
    FROM ondernemingen o WHERE length(nq) >= 3 AND similarity(lower(o.naam), nq) >= 0.3
  UNION ALL SELECT o.id, 50, 'Bedrijfsnaam bevat "' || w || '"', false FROM ondernemingen o, unnest(woorden) w WHERE lower(o.naam) ~ ('\m' || w)
  UNION ALL SELECT o.id, 35, 'Bedrijfsnaam lijkt op "' || w || '" (tikfout)', false
    FROM ondernemingen o, unnest(woorden) w WHERE length(w) >= 4 AND lower(o.naam) !~ ('\m' || w) AND word_similarity(w, lower(o.naam)) >= 0.6
  UNION ALL SELECT po.onderneming_id,
      CASE WHEN lower(p.achternaam) = w THEN 60 ELSE 40 END
      + CASE WHEN lower(coalesce(p.voornaam, '')) = ANY(woorden) OR left(lower(coalesce(p.voornaam, '')), 1) = ANY(init) THEN 15 ELSE 0 END,
      'Contactpersoon ' || btrim(concat_ws(' ', p.voornaam, p.achternaam)) || CASE WHEN lower(p.achternaam) = w THEN ' (achternaam)' ELSE ' (naam lijkt erop)' END, false
    FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id, unnest(woorden) w
   WHERE coalesce(p.achternaam, '') <> '' AND (lower(p.achternaam) = w OR similarity(lower(p.achternaam), w) >= 0.6)
  UNION ALL SELECT po.onderneming_id, 25, 'Voornaam contactpersoon ' || p.voornaam, false
    FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE lower(p.voornaam) = ANY(woorden)
  UNION ALL SELECT o.id, 45 + CASE WHEN EXISTS (SELECT 1 FROM unnest(init) i WHERE lower(o.afas_contactpersoon) ~ ('\m' || i)) THEN 10 ELSE 0 END,
      'Contactpersoon ' || o.afas_contactpersoon || ' past bij "' || w || '"', false
    FROM ondernemingen o, unnest(woorden) w WHERE o.afas_contactpersoon ~* ('\m' || w || '\M')
  UNION ALL SELECT po.onderneming_id, 90, 'Telefoonnummer contactpersoon komt overeen', false
    FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE tel9 IS NOT NULL AND zoek_norm_tel(p.telefoon) = tel9
  UNION ALL SELECT o.id, 70 + CASE WHEN hnr IS NOT NULL AND regexp_replace(coalesce(o.huisnummer, ''), '\D.*$', '') = hnr THEN 20 ELSE 0 END,
      'Postcode ' || o.postcode || coalesce(' ' || o.huisnummer, ''), false
    FROM ondernemingen o WHERE pc IS NOT NULL AND upper(replace(coalesce(o.postcode, ''), ' ', '')) = pc
  UNION ALL SELECT o.id, 25, 'Plaats ' || o.plaats, false FROM ondernemingen o
    WHERE coalesce(o.plaats, '') <> '' AND (lower(o.plaats) = nq OR lower(o.plaats) = ANY(woorden));

  -- Leads en aanvragen
  INSERT INTO _zl
  SELECT l.id, 100, 'Referentie komt overeen', false FROM leads l WHERE ref IS NOT NULL AND replace(l.id::text, '-', '') LIKE ref || '%'
  UNION ALL SELECT l.id, (30 + round(55 * similarity(lower(coalesce(l.voornaam,'') || ' ' || coalesce(l.achternaam,'')), nq)))::int, 'Naam lijkt op "' || nq || '"', false
    FROM leads l WHERE length(nq) >= 3 AND similarity(lower(coalesce(l.voornaam,'') || ' ' || coalesce(l.achternaam,'')), nq) >= 0.35
  UNION ALL SELECT l.id, CASE WHEN lower(l.achternaam) = w THEN 60 ELSE 40 END
      + CASE WHEN lower(coalesce(l.voornaam, '')) = ANY(woorden) OR left(lower(coalesce(l.voornaam, '')), 1) = ANY(init) THEN 15 ELSE 0 END,
      'Achternaam ' || l.achternaam || CASE WHEN lower(l.achternaam) = w THEN '' ELSE ' lijkt erop' END, false
    FROM leads l, unnest(woorden) w WHERE coalesce(l.achternaam, '') <> '' AND (lower(l.achternaam) = w OR similarity(lower(l.achternaam), w) >= 0.6)
  UNION ALL SELECT l.id, 90, 'E-mailadres komt overeen', false FROM leads l WHERE mail IS NOT NULL AND lower(btrim(l.email)) = mail
  UNION ALL SELECT l.id, 60, 'E-maildomein ' || split_part(lower(l.email), '@', 2) || ' past bij "' || w || '"', false
    FROM leads l, unnest(domw) w WHERE split_part(split_part(lower(l.email), '@', 2), '.', 1) <> ALL(algemeen)
     AND similarity(split_part(split_part(lower(l.email), '@', 2), '.', 1), w) >= 0.6
  UNION ALL SELECT l.id, 90, 'Telefoonnummer komt overeen', false FROM leads l WHERE tel9 IS NOT NULL AND zoek_norm_tel(l.telefoon) = tel9
  UNION ALL SELECT l.id, CASE WHEN ibanq IS NOT NULL THEN 95 ELSE 60 END, 'IBAN ' || zoek_masker_iban(l.iban) || ' komt overeen', true
    FROM leads l WHERE l.iban IS NOT NULL AND ((ibanq IS NOT NULL AND lower(regexp_replace(l.iban, '\s', '', 'g')) LIKE ibanq || '%')
      OR (ibansuf IS NOT NULL AND regexp_replace(l.iban, '\s', '', 'g') ~ ('\d' || ibansuf || '$')))
  UNION ALL SELECT l.id, 95, 'KVK-nummer komt overeen', false FROM leads l WHERE ltrim(l.kvk_nummer, '0') = ANY(nums)
  UNION ALL SELECT l.id, 95, 'Exact-relatiecode ' || l.exact_relatie_code || ' komt overeen', false FROM leads l WHERE ltrim(l.exact_relatie_code, '0') = ANY(nums)
  UNION ALL SELECT l.id, 95, 'Factuurnummer ' || l.exact_invoice_number || ' komt overeen', false FROM leads l
    WHERE coalesce(l.exact_invoice_number, '') <> '' AND (ltrim(regexp_replace(l.exact_invoice_number, '\D', '', 'g'), '0') = ANY(nums) OR lower(l.exact_invoice_number) = ql)
  UNION ALL SELECT i.lead_id, 95, 'Factuurnummer ' || i.invoice_number || ' komt overeen', false FROM invoices i
    WHERE i.lead_id IS NOT NULL AND (lower(i.invoice_number) = ql OR (ql ~ '\d' AND length(qc) >= 4 AND lower(regexp_replace(i.invoice_number, '[^a-zA-Z0-9]', '', 'g')) LIKE '%' || qc || '%'))
  UNION ALL SELECT l.id, (30 + round(50 * similarity(lower(l.bedrijfsnaam), nq)))::int, 'Bedrijfsnaam ' || l.bedrijfsnaam || ' lijkt erop', false
    FROM leads l WHERE length(nq) >= 3 AND coalesce(l.bedrijfsnaam, '') <> '' AND (similarity(lower(l.bedrijfsnaam), nq) >= 0.3 OR EXISTS (SELECT 1 FROM unnest(woorden) w WHERE lower(l.bedrijfsnaam) ~ ('\m' || w)))
  UNION ALL SELECT l.id, 70 + CASE WHEN hnr IS NOT NULL AND regexp_replace(coalesce(l.adres_huisnummer, ''), '\D.*$', '') = hnr THEN 20 ELSE 0 END,
      'Postcode ' || l.adres_postcode || coalesce(' ' || l.adres_huisnummer, ''), false
    FROM leads l WHERE pc IS NOT NULL AND upper(replace(coalesce(l.adres_postcode, ''), ' ', '')) = pc
  UNION ALL SELECT l.id, 25, 'Plaats ' || l.adres_plaats, false FROM leads l
    WHERE coalesce(l.adres_plaats, '') <> '' AND (lower(l.adres_plaats) = nq OR lower(l.adres_plaats) = ANY(woorden));

  -- Serviceaanvragen en opzeggingen
  INSERT INTO _zs
  SELECT a.id, 100, 'Referentie komt overeen' FROM klant_service_aanvragen a WHERE ref IS NOT NULL AND replace(a.id::text, '-', '') LIKE ref || '%'
  UNION ALL SELECT a.id, (30 + round(55 * similarity(lower(coalesce(a.voornaam,'') || ' ' || coalesce(a.achternaam,'')), nq)))::int, 'Naam lijkt op "' || nq || '"'
    FROM klant_service_aanvragen a WHERE length(nq) >= 3 AND similarity(lower(coalesce(a.voornaam,'') || ' ' || coalesce(a.achternaam,'')), nq) >= 0.35
  UNION ALL SELECT a.id, CASE WHEN lower(a.achternaam) = w THEN 60 ELSE 40 END
      + CASE WHEN lower(coalesce(a.voornaam, '')) = ANY(woorden) OR left(lower(coalesce(a.voornaam, '')), 1) = ANY(init) THEN 15 ELSE 0 END,
      'Achternaam ' || a.achternaam
    FROM klant_service_aanvragen a, unnest(woorden) w WHERE coalesce(a.achternaam, '') <> '' AND (lower(a.achternaam) = w OR similarity(lower(a.achternaam), w) >= 0.6)
  UNION ALL SELECT a.id, 90, 'E-mailadres komt overeen' FROM klant_service_aanvragen a WHERE mail IS NOT NULL AND lower(btrim(a.email)) = mail
  UNION ALL SELECT a.id, 60, 'E-maildomein ' || split_part(lower(a.email), '@', 2) || ' past bij "' || w || '"'
    FROM klant_service_aanvragen a, unnest(domw) w WHERE split_part(split_part(lower(a.email), '@', 2), '.', 1) <> ALL(algemeen)
     AND similarity(split_part(split_part(lower(a.email), '@', 2), '.', 1), w) >= 0.6
  UNION ALL SELECT a.id, 90, 'Telefoonnummer komt overeen' FROM klant_service_aanvragen a WHERE tel9 IS NOT NULL AND zoek_norm_tel(a.telefoon) = tel9
  UNION ALL SELECT a.id, 95, 'Polisnummer ' || a.polisnummer || ' komt overeen' FROM klant_service_aanvragen a
    WHERE ltrim(regexp_replace(coalesce(a.polisnummer, ''), '\D', '', 'g'), '0') = ANY(nums) AND a.polisnummer ~ '\d'
  UNION ALL SELECT a.id, 85, 'Nummer ' || n || ' staat in de melding' FROM klant_service_aanvragen a, unnest(nums) n
    WHERE length(n) >= 5 AND (coalesce(a.details::text, '') || ' ' || coalesce(a.polisnummer, '')) ~ ('\m0*' || n || '\M')
  UNION ALL SELECT a.id, 50, 'Bedrijfsnaam ' || (a.details->>'bedrijfsnaam') || ' past bij "' || w || '"'
    FROM klant_service_aanvragen a, unnest(woorden) w WHERE lower(coalesce(a.details->>'bedrijfsnaam', '')) ~ ('\m' || w);

  SELECT count(*) INTO n_iban FROM (SELECT 1 FROM _zk WHERE iban UNION ALL SELECT 1 FROM _zl WHERE iban) x;
  IF ibanq IS NOT NULL OR n_iban > 0 THEN
    INSERT INTO sensitive_audit_log(target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
    VALUES ('zoeken', NULL, 'zoeken_iban', 'iban', NULL, me, auth.jwt()->>'email', public.get_user_role_label(me),
            jsonb_build_object('zoekterm_gemaskeerd', CASE WHEN ibanq IS NOT NULL THEN zoek_masker_iban(ibanq) ELSE '****' || right(ibansuf, 4) END,
                               'iban_treffers', n_iban));
  END IF;

  WITH kg AS (
    SELECT z.id, LEAST(100, max(z.sc) + 5 * (count(DISTINCT z.r) - 1))::int AS score, array_agg(DISTINCT z.r) AS redenen
      FROM _zk z JOIN ondernemingen o ON o.id = z.id WHERE z.id IS NOT NULL AND (_met_test OR NOT o.is_test)
     GROUP BY z.id HAVING max(z.sc) >= 30 ORDER BY 2 DESC LIMIT 15
  ), kj AS (
    SELECT kg.score, jsonb_build_object('id', o.id, 'onderneming_id', o.id, 'titel', o.naam, 'score', kg.score, 'redenen', to_jsonb(kg.redenen),
      'link', '/admin/klanten/' || o.id,
      'contactpersoon', coalesce((SELECT string_agg(btrim(concat_ws(' ', p.voornaam, p.achternaam)), ', ') FROM persoon_onderneming po JOIN personen p ON p.id = po.persoon_id WHERE po.onderneming_id = o.id), o.afas_contactpersoon),
      'email', coalesce(o.factuur_email, (SELECT p.email_weergave FROM persoon_onderneming po JOIN personen p ON p.id = po.persoon_id WHERE po.onderneming_id = o.id LIMIT 1)),
      'exact_relatie_code', o.exact_relatie_code, 'kvk', o.kvk, 'plaats', o.plaats, 'iban', zoek_masker_iban(o.iban),
      'bav_nummer', (SELECT b.nummer FROM crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','afas') ORDER BY (b.bron = 'zp') DESC, b.datum DESC NULLS LAST LIMIT 1),
      'is_test', o.is_test) AS j
      FROM kg JOIN ondernemingen o ON o.id = kg.id
  ), cg AS (
    SELECT k.id, 95 AS score, ARRAY['Abonnementsnummer ' || k.abonnement_nr || ' komt overeen'] AS redenen FROM klant_contracten k
     WHERE (_met_test OR NOT k.is_test) AND (ltrim(regexp_replace(coalesce(k.abonnement_nr, ''), '\D', '', 'g'), '0') = ANY(nums) AND k.abonnement_nr ~ '\d')
    UNION
    SELECT k.id, kg.score - 10, ARRAY['Contract van gevonden klant'] FROM klant_contracten k JOIN kg ON kg.id = k.onderneming_id
     WHERE kg.score >= 80 AND (_met_test OR NOT k.is_test)
  ), cj AS (
    SELECT max(cg.score) AS score, jsonb_build_object('id', k.id, 'onderneming_id', k.onderneming_id, 'titel', coalesce(o.naam, 'Onbekende klant') || ' · ' || coalesce(k.product, k.itemcode, 'contract'),
      'score', max(cg.score), 'redenen', to_jsonb(array_agg(DISTINCT r)), 'link', '/admin/klanten/' || k.onderneming_id,
      'bav_nummer', k.abonnement_nr, 'status', k.status, 'cyclus', k.cyclus, 'bedrag', k.bedrag_per_periode, 'exact_relatie_code', o.exact_relatie_code) AS j
      FROM cg JOIN klant_contracten k ON k.id = cg.id LEFT JOIN ondernemingen o ON o.id = k.onderneming_id, unnest(cg.redenen) r
     GROUP BY k.id, o.id ORDER BY 1 DESC LIMIT 15
  ), lg AS (
    SELECT z.id, LEAST(100, max(z.sc) + 5 * (count(DISTINCT z.r) - 1))::int AS score, array_agg(DISTINCT z.r) AS redenen
      FROM _zl z JOIN leads l ON l.id = z.id WHERE z.id IS NOT NULL AND (_met_test OR NOT l.is_test)
     GROUP BY z.id HAVING max(z.sc) >= 30 ORDER BY 2 DESC LIMIT 15
  ), lj AS (
    SELECT lg.score, jsonb_build_object('id', l.id, 'titel', btrim(concat_ws(' ', l.voornaam, l.achternaam)) || coalesce(' · ' || l.bedrijfsnaam, ''),
      'score', lg.score, 'redenen', to_jsonb(lg.redenen), 'onderneming_id', ond.id,
      'link', CASE WHEN ond.id IS NOT NULL THEN '/admin/klanten/' || ond.id ELSE '/admin/leads/' || l.id END,
      'lead_link', '/admin/leads/' || l.id, 'email', l.email, 'status', l.status, 'type', l.type, 'kvk', l.kvk_nummer,
      'exact_relatie_code', l.exact_relatie_code, 'iban', zoek_masker_iban(l.iban), 'plaats', l.adres_plaats, 'is_test', l.is_test) AS j
      FROM lg JOIN leads l ON l.id = lg.id
      LEFT JOIN LATERAL (SELECT po.onderneming_id AS id FROM persoon_bron_koppeling pb JOIN persoon_onderneming po ON po.persoon_id = pb.persoon_id
                          WHERE pb.bron_tabel = 'leads' AND pb.bron_id = l.id LIMIT 1) ond ON true
  ), sg AS (
    SELECT z.id, LEAST(100, max(z.sc) + 5 * (count(DISTINCT z.r) - 1))::int AS score, array_agg(DISTINCT z.r) AS redenen
      FROM _zs z JOIN klant_service_aanvragen a ON a.id = z.id WHERE (_met_test OR NOT a.is_test)
     GROUP BY z.id HAVING max(z.sc) >= 30 ORDER BY 2 DESC LIMIT 30
  ), sj AS (
    SELECT sg.score, a.type, jsonb_build_object('id', a.id, 'titel', btrim(concat_ws(' ', a.voornaam, a.achternaam)) || coalesce(' · ' || nullif(a.details->>'bedrijfsnaam', ''), ''),
      'score', sg.score, 'redenen', to_jsonb(sg.redenen), 'onderneming_id', a.onderneming_id,
      'link', CASE WHEN a.onderneming_id IS NOT NULL THEN '/admin/klanten/' || a.onderneming_id ELSE '/admin/service-aanvragen/' || a.id END,
      'aanvraag_link', '/admin/service-aanvragen/' || a.id, 'email', a.email, 'type', a.type, 'status', a.status,
      'polisnummer', a.polisnummer, 'datum', a.created_at, 'is_test', a.is_test) AS j
      FROM sg JOIN klant_service_aanvragen a ON a.id = sg.id
  )
  SELECT jsonb_build_object(
    'klanten', coalesce((SELECT jsonb_agg(j ORDER BY score DESC) FROM kj), '[]'::jsonb),
    'contracten', coalesce((SELECT jsonb_agg(j ORDER BY score DESC) FROM cj), '[]'::jsonb),
    'leads', coalesce((SELECT jsonb_agg(j ORDER BY score DESC) FROM lj), '[]'::jsonb),
    'opzeggingen', coalesce((SELECT jsonb_agg(j ORDER BY score DESC) FROM sj WHERE type = 'opzeggen'), '[]'::jsonb),
    'service', coalesce((SELECT jsonb_agg(j ORDER BY score DESC) FROM sj WHERE type <> 'opzeggen'), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END $function$;

REVOKE ALL ON FUNCTION public.zoek_universeel(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zoek_universeel(text, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.zoek_norm_tel(text) FROM anon;
REVOKE ALL ON FUNCTION public.zoek_masker_iban(text) FROM anon;