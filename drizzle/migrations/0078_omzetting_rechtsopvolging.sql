CREATE TABLE public.partner_bronnen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  zoekterm text NOT NULL CHECK (length(btrim(zoekterm)) >= 3),
  actief boolean NOT NULL DEFAULT true,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zoekterm)
);
GRANT SELECT, INSERT, UPDATE ON public.partner_bronnen TO authenticated;
GRANT ALL ON public.partner_bronnen TO service_role;
ALTER TABLE public.partner_bronnen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest partners" ON public.partner_bronnen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor voegt partner toe" ON public.partner_bronnen FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor wijzigt partner" ON public.partner_bronnen FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
COMMENT ON TABLE public.partner_bronnen IS 'Partners/collectieven: klanten die hierlangs komen krijgen bij omzetting nooit het BAV-nummer van de voorganger.';

CREATE TABLE public.omzetting_beslissingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  van_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  naar_onderneming_id uuid REFERENCES public.ondernemingen(id),
  keuze text NOT NULL CHECK (keuze IN ('omzetting','nieuwe_klant')),
  bav_nummer text,
  bav_herkomst text,
  toelichting text,
  beslist_door uuid NOT NULL,
  beslist_op timestamptz NOT NULL DEFAULT now(),
  is_test boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.omzetting_beslissingen TO authenticated;
GRANT ALL ON public.omzetting_beslissingen TO service_role;
ALTER TABLE public.omzetting_beslissingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest omzettingsbeslissingen" ON public.omzetting_beslissingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

ALTER TABLE public.onderneming_opvolging ADD COLUMN IF NOT EXISTS bav_nummer text, ADD COLUMN IF NOT EXISTS bav_nummer_herkomst text, ADD COLUMN IF NOT EXISTS lead_id uuid;

CREATE OR REPLACE VIEW public.crm_bav_nummers WITH (security_invoker = on) AS
SELECT 'zp'::text AS bron, btrim(p.certificate_number) AS nummer, p.onderneming_id, p.lead_id, p.id AS policy_id, NULL::uuid AS contract_id, p.status, p.created_at AS datum
  FROM public.policies p WHERE coalesce(btrim(p.certificate_number),'') <> ''
UNION ALL
SELECT 'zp', btrim(kc.certificaatnummer), kc.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, kc.koppeling_status, kc.aanvraagdatum::timestamptz
  FROM public.klant_certificaten kc WHERE kc.onderneming_id IS NOT NULL AND kc.koppeling_status = 'bevestigd' AND coalesce(btrim(kc.certificaatnummer),'') <> ''
UNION ALL
SELECT 'afas', btrim(k.abonnement_nr), k.onderneming_id, NULL::uuid, NULL::uuid, k.id, k.status, k.begin_datum::timestamptz
  FROM public.klant_contracten k WHERE coalesce(btrim(k.abonnement_nr),'') <> ''
UNION ALL
SELECT CASE WHEN a.polisnummer ~* '^\s*HPI\.' THEN 'hiscox' ELSE 'klant' END, upper(btrim(a.polisnummer)), a.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, a.status, a.created_at
  FROM public.klant_service_aanvragen a WHERE coalesce(btrim(a.polisnummer),'') <> ''
UNION ALL
SELECT 'overgenomen', btrim(o.bav_nummer), o.naar_onderneming_id, o.lead_id, NULL::uuid, NULL::uuid, 'overgenomen', o.vastgelegd_op
  FROM public.onderneming_opvolging o WHERE coalesce(btrim(o.bav_nummer),'') <> '';
REVOKE ALL ON public.crm_bav_nummers FROM anon, public;
GRANT SELECT ON public.crm_bav_nummers TO authenticated;
GRANT SELECT ON public.crm_bav_nummers TO service_role;

CREATE OR REPLACE FUNCTION public.onderneming_is_partner(_ond uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pb.naam FROM public.partner_bronnen pb JOIN public.ondernemingen o ON o.id = _ond
   WHERE pb.actief AND (
     o.naam ILIKE '%'||pb.zoekterm||'%' OR coalesce(o.afas_contactpersoon,'') ILIKE '%'||pb.zoekterm||'%' OR coalesce(o.bron,'') ILIKE '%'||pb.zoekterm||'%'
     OR EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND (k.product ILIKE '%'||pb.zoekterm||'%' OR coalesce(k.itemcode,'') ILIKE '%'||pb.zoekterm||'%'))
     OR EXISTS (SELECT 1 FROM public.leads l WHERE o.exact_relatie_code IS NOT NULL AND l.exact_relatie_code = o.exact_relatie_code AND coalesce(l.extra_data::text,'') ILIKE '%'||pb.zoekterm||'%'))
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.onderneming_is_partner(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.onderneming_is_partner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.omzetting_kandidaten(_lead_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; v_kvk text; v_tel text; v_mail text; v_local text; v_dom text; v_iban text; v_pc text; v_res jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_kvk := nullif(regexp_replace(coalesce(l.kvk_nummer,''),'\D','','g'),'');
  v_tel := nullif(right(regexp_replace(coalesce(l.telefoon,''),'\D','','g'),9),'');
  IF length(coalesce(v_tel,'')) < 9 THEN v_tel := NULL; END IF;
  v_mail := nullif(lower(btrim(coalesce(l.email,''))),'');
  v_local := split_part(v_mail,'@',1); v_dom := split_part(v_mail,'@',2);
  v_iban := nullif(upper(regexp_replace(coalesce(l.iban,''),'\s','','g')),'');
  v_pc := nullif(upper(regexp_replace(coalesce(l.adres_postcode,''),'\s','','g')),'');

  WITH eigen AS (SELECT id FROM public.ondernemingen WHERE v_kvk IS NOT NULL AND regexp_replace(coalesce(kvk,''),'\D','','g') = v_kvk),
  sig AS (
    SELECT po.onderneming_id AS ond, 'zelfde naam contactpersoon ('||p.voornaam||' '||p.achternaam||')' AS signaal, 1 AS gewicht
      FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
     WHERE l.voornaam IS NOT NULL AND l.achternaam IS NOT NULL AND lower(btrim(p.voornaam)) = lower(btrim(l.voornaam)) AND lower(btrim(p.achternaam)) = lower(btrim(l.achternaam))
    UNION ALL
    SELECT po.onderneming_id, 'zelfde e-mailadres', 3 FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id WHERE v_mail IS NOT NULL AND p.genormaliseerd_email = v_mail
    UNION ALL
    SELECT po.onderneming_id, 'e-mail '||p.genormaliseerd_email||' (zelfde naam voor @, ander domein)', 1
      FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
     WHERE v_mail IS NOT NULL AND v_local NOT IN ('info','admin','contact','mail','hallo','hello','office','administratie','finance','post')
       AND split_part(p.genormaliseerd_email,'@',1) = v_local AND split_part(p.genormaliseerd_email,'@',2) <> v_dom
    UNION ALL
    SELECT po.onderneming_id, 'zelfde telefoonnummer', 2 FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id
     WHERE v_tel IS NOT NULL AND right(regexp_replace(coalesce(p.telefoon,''),'\D','','g'),9) = v_tel
    UNION ALL
    SELECT a.onderneming_id, 'zelfde telefoonnummer (serviceaanvraag)', 2 FROM public.klant_service_aanvragen a
     WHERE v_tel IS NOT NULL AND a.onderneming_id IS NOT NULL AND right(regexp_replace(coalesce(a.telefoon,''),'\D','','g'),9) = v_tel
    UNION ALL
    SELECT o.id, 'zelfde IBAN', 3 FROM public.ondernemingen o WHERE v_iban IS NOT NULL AND upper(regexp_replace(coalesce(o.iban,''),'\s','','g')) = v_iban
    UNION ALL
    SELECT o.id, 'zelfde adres', 1 FROM public.ondernemingen o
     WHERE v_pc IS NOT NULL AND l.adres_huisnummer IS NOT NULL
       AND ((upper(regexp_replace(coalesce(o.postcode,''),'\s','','g')) = v_pc AND btrim(o.huisnummer) = btrim(l.adres_huisnummer))
         OR (upper(regexp_replace(coalesce(o.kvk_postcode,''),'\s','','g')) = v_pc AND btrim(o.kvk_huisnummer) = btrim(l.adres_huisnummer)))
    UNION ALL
    SELECT a.onderneming_id, 'opzegging op '||to_char(a.created_at AT TIME ZONE 'Europe/Amsterdam','DD-MM-YYYY HH24:MI')||' met reden "'||coalesce(a.details->>'reden','')||'"', 3
      FROM public.klant_service_aanvragen a
     WHERE a.type = 'opzeggen' AND a.onderneming_id IS NOT NULL AND a.gekoppeld_aan IS NULL
       AND (coalesce(a.details->>'reden','') ILIKE '%entiteit%' OR coalesce(a.details->>'reden','') ILIKE '%omzetting%')
       AND a.created_at BETWEEN l.created_at - interval '90 days' AND l.created_at + interval '30 days'
       AND ((v_mail IS NOT NULL AND lower(btrim(a.email)) = v_mail) OR (v_tel IS NOT NULL AND right(regexp_replace(coalesce(a.telefoon,''),'\D','','g'),9) = v_tel)
         OR (lower(btrim(a.achternaam)) = lower(btrim(coalesce(l.achternaam,''))) AND lower(btrim(a.voornaam)) = lower(btrim(coalesce(l.voornaam,''))))
         OR EXISTS (SELECT 1 FROM public.persoon_onderneming po JOIN public.personen p ON p.id = po.persoon_id WHERE po.onderneming_id = a.onderneming_id
              AND lower(btrim(p.voornaam)) = lower(btrim(coalesce(l.voornaam,''))) AND lower(btrim(p.achternaam)) = lower(btrim(coalesce(l.achternaam,'')))))
  ),
  agg AS (
    SELECT s.ond, array_agg(DISTINCT s.signaal) AS signalen, sum(DISTINCT s.gewicht) AS score, bool_or(s.signaal LIKE 'opzegging op%') AS entiteit
      FROM sig s JOIN public.ondernemingen o ON o.id = s.ond
     WHERE s.ond NOT IN (SELECT id FROM eigen) AND (v_kvk IS NULL OR regexp_replace(coalesce(o.kvk,''),'\D','','g') <> v_kvk)
     GROUP BY s.ond
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'onderneming_id', o.id, 'naam', o.naam, 'kvk', o.kvk, 'rechtsvorm', o.rechtsvorm, 'exact_relatie_code', o.exact_relatie_code,
      'klant_sinds', least((SELECT min(k.begin_datum) FROM public.klant_contracten k WHERE k.onderneming_id = o.id), o.created_at::date),
      'signalen', a.signalen, 'score', a.score, 'entiteit_opzegging', a.entiteit,
      'partner', public.onderneming_is_partner(o.id),
      'actieve_contracten', (SELECT count(*) FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND (k.eind_datum IS NULL OR k.eind_datum > (now() AT TIME ZONE 'Europe/Amsterdam')::date)),
      'bav_nummers', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('nummer', b.nummer, 'bron', b.bron, 'datum', b.datum::date)), '[]'::jsonb) FROM public.crm_bav_nummers b WHERE b.onderneming_id = o.id AND b.bron IN ('zp','afas','klant','overgenomen')),
      'beslissing', (SELECT to_jsonb(x) FROM public.omzetting_beslissingen x WHERE x.lead_id = l.id AND x.van_onderneming_id = o.id ORDER BY x.beslist_op DESC LIMIT 1)
    ) ORDER BY a.entiteit DESC, a.score DESC), '[]'::jsonb)
    INTO v_res
    FROM agg a JOIN public.ondernemingen o ON o.id = a.ond
   WHERE a.entiteit OR a.score >= 2;
  RETURN jsonb_build_object('eigen_onderneming_id', (SELECT id FROM public.ondernemingen WHERE v_kvk IS NOT NULL AND regexp_replace(coalesce(kvk,''),'\D','','g') = v_kvk ORDER BY created_at LIMIT 1), 'kandidaten', v_res);
END $$;
REVOKE ALL ON FUNCTION public.omzetting_kandidaten(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.omzetting_kandidaten(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.omzetting_vastleggen(_lead_id uuid, _van uuid, _keuze text, _bav_nummer text, _toelichting text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; v_naar uuid; vo public.ondernemingen; nn public.ondernemingen; v_herkomst text; v_partner text; v_id uuid; v_kvk text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _keuze NOT IN ('omzetting','nieuwe_klant') THEN RAISE EXCEPTION 'ongeldige keuze'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'lead niet gevonden'; END IF;
  SELECT * INTO vo FROM public.ondernemingen WHERE id = _van;
  IF vo.id IS NULL THEN RAISE EXCEPTION 'voorganger niet gevonden'; END IF;
  v_kvk := nullif(regexp_replace(coalesce(l.kvk_nummer,''),'\D','','g'),'');
  SELECT * INTO nn FROM public.ondernemingen WHERE v_kvk IS NOT NULL AND regexp_replace(coalesce(kvk,''),'\D','','g') = v_kvk ORDER BY created_at LIMIT 1;
  v_naar := nn.id;

  IF _keuze = 'omzetting' THEN
    IF v_naar IS NULL THEN RAISE EXCEPTION 'de nieuwe onderneming (KvK %) bestaat nog niet in het CRM', coalesce(v_kvk,'onbekend'); END IF;
    IF v_naar = _van THEN RAISE EXCEPTION 'voorganger en opvolger zijn dezelfde onderneming'; END IF;
    v_partner := public.onderneming_is_partner(_van);
    IF v_partner IS NOT NULL THEN RAISE EXCEPTION 'voorganger komt via partner %: nieuw BAV-nummer, niet overnemen', v_partner; END IF;
    SELECT b.bron INTO v_herkomst FROM public.crm_bav_nummers b WHERE b.onderneming_id = _van AND b.nummer = btrim(_bav_nummer) AND b.bron IN ('zp','afas','klant','overgenomen') LIMIT 1;
    IF v_herkomst IS NULL THEN RAISE EXCEPTION 'kies een BAV-nummer dat bij de voorganger bekend is'; END IF;
    IF EXISTS (SELECT 1 FROM public.onderneming_opvolging WHERE naar_onderneming_id = v_naar AND coalesce(bav_nummer,'') <> '' AND van_onderneming_id <> _van) THEN
      RAISE EXCEPTION 'deze onderneming heeft al een overgenomen BAV-nummer van een andere voorganger'; END IF;
    INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test, bav_nummer, bav_nummer_herkomst, lead_id)
    VALUES (_van, v_naar, coalesce(l.ingangsdatum, (now() AT TIME ZONE 'Europe/Amsterdam')::date), 'rechtsvormwijziging', nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), l.is_test, btrim(_bav_nummer), v_herkomst, l.id)
    ON CONFLICT (van_onderneming_id, naar_onderneming_id) DO UPDATE
      SET bav_nummer = coalesce(public.onderneming_opvolging.bav_nummer, EXCLUDED.bav_nummer),
          bav_nummer_herkomst = coalesce(public.onderneming_opvolging.bav_nummer_herkomst, EXCLUDED.bav_nummer_herkomst),
          lead_id = coalesce(public.onderneming_opvolging.lead_id, EXCLUDED.lead_id);
    PERFORM public.crm_notitie_toevoegen(v_naar, NULL, 'ondernemingswijziging',
      'Omzetting vastgelegd: rechtsvoorganger ' || vo.naam || '. BAV-nummer ' || btrim(_bav_nummer) || ' overgenomen (herkomst ' || v_herkomst || '). Oud contract niet automatisch beeindigd.', jsonb_build_object('lead_id', l.id, 'van', _van));
    PERFORM public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
      'Voortgezet als ' || nn.naam || ' (KvK ' || coalesce(nn.kvk,'-') || '). BAV-nummer ' || btrim(_bav_nummer) || ' gaat mee. Oud contract niet automatisch beeindigd.', jsonb_build_object('lead_id', l.id, 'naar', v_naar));
  END IF;

  INSERT INTO public.omzetting_beslissingen (lead_id, van_onderneming_id, naar_onderneming_id, keuze, bav_nummer, bav_herkomst, toelichting, beslist_door, is_test)
  VALUES (l.id, _van, v_naar, _keuze, CASE WHEN _keuze = 'omzetting' THEN btrim(_bav_nummer) END, v_herkomst, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), l.is_test)
  RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('omzetting_beslissingen', v_id, CASE WHEN _keuze = 'omzetting' THEN 'omzetting_bav_overgenomen' ELSE 'omzetting_afgewezen_nieuwe_klant' END, 'bav_nummer',
    NULL, CASE WHEN _keuze = 'omzetting' THEN btrim(_bav_nummer) END, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('lead_id', l.id, 'van_onderneming_id', _van, 'van_naam', vo.naam, 'naar_onderneming_id', v_naar, 'herkomst', v_herkomst));
  RETURN jsonb_build_object('id', v_id, 'naar_onderneming_id', v_naar);
END $$;
REVOKE ALL ON FUNCTION public.omzetting_vastleggen(uuid, uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.omzetting_vastleggen(uuid, uuid, text, text, text) TO authenticated;