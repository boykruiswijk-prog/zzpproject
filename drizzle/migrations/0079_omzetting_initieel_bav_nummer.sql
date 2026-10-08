CREATE OR REPLACE VIEW public.crm_bav_nummers WITH (security_invoker = on) AS
WITH basis AS (
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
)
SELECT * FROM basis
UNION ALL
SELECT 'overgenomen', btrim(o.bav_nummer), o.naar_onderneming_id, o.lead_id, NULL::uuid, NULL::uuid, 'leidend',
       coalesce((SELECT min(b.datum) FROM basis b WHERE b.onderneming_id = o.van_onderneming_id AND b.nummer = btrim(o.bav_nummer)), o.vastgelegd_op)
  FROM public.onderneming_opvolging o WHERE coalesce(btrim(o.bav_nummer),'') <> ''
UNION ALL
SELECT 'overgenomen', b.nummer, o.naar_onderneming_id, o.lead_id, NULL::uuid, NULL::uuid, 'meegenomen', min(b.datum)
  FROM public.onderneming_opvolging o JOIN basis b ON b.onderneming_id = o.van_onderneming_id AND b.bron IN ('zp','afas','klant') AND b.nummer <> btrim(o.bav_nummer)
 WHERE coalesce(btrim(o.bav_nummer),'') <> ''
 GROUP BY b.nummer, o.naar_onderneming_id, o.lead_id;
REVOKE ALL ON public.crm_bav_nummers FROM anon, public;
GRANT SELECT ON public.crm_bav_nummers TO authenticated;
GRANT SELECT ON public.crm_bav_nummers TO service_role;

-- Leidend BAV-nummer bij omzetting = initieel (oudste) nummer van de voorganger; opgave klant alleen als niets anders bekend is.
CREATE OR REPLACE FUNCTION public.omzetting_leidend_bav(_van uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT b.nummer, b.bron, min(b.datum)::date AS datum INTO r FROM public.crm_bav_nummers b
   WHERE b.onderneming_id = _van AND b.bron IN ('zp','afas','klant','overgenomen') AND (b.bron <> 'overgenomen' OR b.status = 'leidend')
   GROUP BY b.nummer, b.bron
   ORDER BY (b.bron = 'overgenomen') DESC, (b.bron = 'klant'), min(b.datum) NULLS LAST, b.nummer LIMIT 1;
  IF r.nummer IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('nummer', r.nummer, 'bron', r.bron, 'datum', r.datum);
END $$;
REVOKE ALL ON FUNCTION public.omzetting_leidend_bav(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.omzetting_leidend_bav(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.omzetting_vastleggen(_lead_id uuid, _van uuid, _keuze text, _bav_nummer text, _toelichting text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leads; v_naar uuid; vo public.ondernemingen; nn public.ondernemingen; v_herkomst text; v_partner text; v_id uuid; v_kvk text; v_leidend jsonb; v_nummer text;
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
    v_leidend := public.omzetting_leidend_bav(_van);
    v_nummer := v_leidend->>'nummer'; v_herkomst := v_leidend->>'bron';
    IF v_nummer IS NULL THEN RAISE EXCEPTION 'bij de voorganger is geen BAV-nummer bekend'; END IF;
    IF coalesce(btrim(_bav_nummer),'') <> '' AND btrim(_bav_nummer) <> v_nummer THEN
      RAISE EXCEPTION 'leidend is het initiele BAV-nummer % van de voorganger', v_nummer; END IF;
    IF EXISTS (SELECT 1 FROM public.onderneming_opvolging WHERE naar_onderneming_id = v_naar AND coalesce(bav_nummer,'') <> '' AND van_onderneming_id <> _van) THEN
      RAISE EXCEPTION 'deze onderneming heeft al een overgenomen BAV-nummer van een andere voorganger'; END IF;
    INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test, bav_nummer, bav_nummer_herkomst, lead_id)
    VALUES (_van, v_naar, coalesce(l.ingangsdatum, (now() AT TIME ZONE 'Europe/Amsterdam')::date), 'rechtsvormwijziging', nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), l.is_test, v_nummer, v_herkomst, l.id)
    ON CONFLICT (van_onderneming_id, naar_onderneming_id) DO UPDATE
      SET bav_nummer = coalesce(public.onderneming_opvolging.bav_nummer, EXCLUDED.bav_nummer),
          bav_nummer_herkomst = coalesce(public.onderneming_opvolging.bav_nummer_herkomst, EXCLUDED.bav_nummer_herkomst),
          lead_id = coalesce(public.onderneming_opvolging.lead_id, EXCLUDED.lead_id);
    PERFORM public.crm_notitie_toevoegen(v_naar, NULL, 'ondernemingswijziging',
      'Omzetting vastgelegd: rechtsvoorganger ' || vo.naam || ' (Exact-relatiecode ' || coalesce(vo.exact_relatie_code,'onbekend') || '). Leidend BAV-nummer ' || v_nummer || ' (initieel, herkomst ' || v_herkomst || '); overige BAV-nummers van de voorganger gaan mee. Eigen Exact-relatiecode via de Exact-koppeling. Oud contract niet automatisch beeindigd.', jsonb_build_object('lead_id', l.id, 'van', _van));
    PERFORM public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
      'Voortgezet als ' || nn.naam || ' (KvK ' || coalesce(nn.kvk,'-') || '). BAV-nummers gaan mee, leidend ' || v_nummer || '. Oud contract niet automatisch beeindigd.', jsonb_build_object('lead_id', l.id, 'naar', v_naar));
  END IF;

  INSERT INTO public.omzetting_beslissingen (lead_id, van_onderneming_id, naar_onderneming_id, keuze, bav_nummer, bav_herkomst, toelichting, beslist_door, is_test)
  VALUES (l.id, _van, v_naar, _keuze, CASE WHEN _keuze = 'omzetting' THEN v_nummer END, v_herkomst, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), l.is_test)
  RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('omzetting_beslissingen', v_id, CASE WHEN _keuze = 'omzetting' THEN 'omzetting_bav_overgenomen' ELSE 'omzetting_afgewezen_nieuwe_klant' END, 'bav_nummer',
    NULL, CASE WHEN _keuze = 'omzetting' THEN v_nummer END, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('lead_id', l.id, 'van_onderneming_id', _van, 'van_naam', vo.naam, 'van_exact_relatie_code', vo.exact_relatie_code, 'naar_onderneming_id', v_naar, 'herkomst', v_herkomst));
  RETURN jsonb_build_object('id', v_id, 'naar_onderneming_id', v_naar, 'bav_nummer', v_nummer);
END $$;
REVOKE ALL ON FUNCTION public.omzetting_vastleggen(uuid, uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.omzetting_vastleggen(uuid, uuid, text, text, text) TO authenticated;