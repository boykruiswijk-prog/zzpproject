CREATE TABLE public.crm_notities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid REFERENCES public.ondernemingen(id),
  persoon_id uuid REFERENCES public.personen(id),
  soort text NOT NULL DEFAULT 'notitie' CHECK (soort IN ('notitie','telefoon','opzegging','stop','ondernemingswijziging','overig')),
  tekst text NOT NULL CHECK (length(btrim(tekst)) BETWEEN 1 AND 10000),
  aangemaakt_door uuid NOT NULL,
  aangemaakt_door_naam text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  ingetrokken_op timestamptz,
  ingetrokken_door uuid,
  intrek_reden text,
  is_test boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (onderneming_id IS NOT NULL OR persoon_id IS NOT NULL)
);
CREATE INDEX ON public.crm_notities (onderneming_id);
CREATE INDEX ON public.crm_notities (persoon_id);
GRANT SELECT ON public.crm_notities TO authenticated;
GRANT ALL ON public.crm_notities TO service_role;
ALTER TABLE public.crm_notities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest crm-notities" ON public.crm_notities FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE TABLE public.crm_notitie_bijlagen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notitie_id uuid NOT NULL REFERENCES public.crm_notities(id),
  storage_pad text NOT NULL UNIQUE,
  bestandsnaam text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf')),
  grootte integer NOT NULL CHECK (grootte > 0 AND grootte <= 10485760),
  geupload_door uuid NOT NULL,
  geupload_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.crm_notitie_bijlagen (notitie_id);
GRANT SELECT, INSERT ON public.crm_notitie_bijlagen TO authenticated;
GRANT ALL ON public.crm_notitie_bijlagen TO service_role;
ALTER TABLE public.crm_notitie_bijlagen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest notitiebijlagen" ON public.crm_notitie_bijlagen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team voegt notitiebijlagen toe" ON public.crm_notitie_bijlagen FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()) AND geupload_door = auth.uid()
    AND storage_pad LIKE 'notities/' || notitie_id::text || '/%'
    AND EXISTS (SELECT 1 FROM public.crm_notities n WHERE n.id = notitie_id AND n.ingetrokken_op IS NULL));

CREATE TABLE public.onderneming_opvolging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  naar_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  ingangsdatum date NOT NULL,
  soort text NOT NULL DEFAULT 'rechtsvormwijziging' CHECK (soort IN ('rechtsvormwijziging','overname','overig')),
  toelichting text,
  vastgelegd_door uuid NOT NULL,
  vastgelegd_op timestamptz NOT NULL DEFAULT now(),
  is_test boolean NOT NULL DEFAULT false,
  CHECK (van_onderneming_id <> naar_onderneming_id),
  UNIQUE (van_onderneming_id, naar_onderneming_id)
);
GRANT SELECT ON public.onderneming_opvolging TO authenticated;
GRANT ALL ON public.onderneming_opvolging TO service_role;
ALTER TABLE public.onderneming_opvolging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest opvolging" ON public.onderneming_opvolging FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

-- Helpers
CREATE OR REPLACE FUNCTION public.mag_crm_beeindigen(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_team_member(_uid) AND (public.is_supervisor_or_admin(_uid) OR public.has_role(_uid, 'verzekering'))
$$;

CREATE OR REPLACE FUNCTION public.crm_notitie_toevoegen(_onderneming_id uuid, _persoon_id uuid, _soort text, _tekst text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_naam text; v_test boolean := false;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _onderneming_id IS NULL AND _persoon_id IS NULL THEN RAISE EXCEPTION 'kies een onderneming of persoon'; END IF;
  IF _soort NOT IN ('notitie','telefoon','opzegging','stop','ondernemingswijziging','overig') THEN RAISE EXCEPTION 'ongeldige soort'; END IF;
  IF length(btrim(coalesce(_tekst,''))) = 0 THEN RAISE EXCEPTION 'tekst is verplicht'; END IF;
  SELECT coalesce(nullif(full_name,''), email) INTO v_naam FROM public.profiles WHERE id = auth.uid();
  SELECT coalesce((SELECT is_test FROM public.ondernemingen WHERE id = _onderneming_id), false)
      OR coalesce((SELECT is_test FROM public.personen WHERE id = _persoon_id), false) INTO v_test;
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
  VALUES (_onderneming_id, _persoon_id, _soort, btrim(_tekst), auth.uid(), v_naam, v_test, coalesce(_details,'{}'::jsonb))
  RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('crm_notities', v_id, 'notitie_toegevoegd', 'soort', _soort, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', _onderneming_id, 'persoon_id', _persoon_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.crm_notitie_intrekken(_id uuid, _reden text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.crm_notities;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO n FROM public.crm_notities WHERE id = _id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'notitie niet gevonden'; END IF;
  IF n.ingetrokken_op IS NOT NULL THEN RAISE EXCEPTION 'notitie is al ingetrokken'; END IF;
  IF n.aangemaakt_door <> auth.uid() AND NOT public.is_supervisor_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'alleen de schrijver of supervisor/admin kan intrekken';
  END IF;
  IF length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'geef een reden op'; END IF;
  UPDATE public.crm_notities SET ingetrokken_op = now(), ingetrokken_door = auth.uid(), intrek_reden = btrim(_reden) WHERE id = _id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('crm_notities', _id, 'notitie_ingetrokken', 'ingetrokken_op', now()::text, auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('reden', _reden));
  RETURN true;
END $$;

-- Handmatig beeindigen: zelfde kern als verwerk_opzegging (contract eind_datum/status + plan_opzeg_credit)
CREATE OR REPLACE FUNCTION public.crm_beeindig(_onderneming_id uuid, _contract_ids uuid[], _policy_ids uuid[],
  _einddatum date, _reden text, _toelichting text, _persoon_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ondernemingen; p record; r record; v_aid uuid; n int := 0; np int := 0; credits jsonb := '[]'::jsonb;
  v_notitie uuid; v_tekst text; v_label text; v_regels text := '';
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF _reden NOT IN ('opzegging_klant','eerdere_opzegging','ondernemingswijziging','wanbetaling','stoppen_onderneming','overig') THEN RAISE EXCEPTION 'ongeldige reden'; END IF;
  IF length(btrim(coalesce(_toelichting,''))) < 3 THEN RAISE EXCEPTION 'toelichting is verplicht'; END IF;
  IF _einddatum IS NULL OR _einddatum > (now() AT TIME ZONE 'Europe/Amsterdam')::date + 366 THEN RAISE EXCEPTION 'ongeldige einddatum'; END IF;
  IF coalesce(array_length(_contract_ids,1),0) + coalesce(array_length(_policy_ids,1),0) = 0 THEN RAISE EXCEPTION 'kies minstens een contract of polis'; END IF;
  v_label := CASE _reden WHEN 'opzegging_klant' THEN 'Opzegging klant' WHEN 'eerdere_opzegging' THEN 'Eerdere opzegging niet verwerkt'
    WHEN 'ondernemingswijziging' THEN 'Ondernemingswijziging' WHEN 'wanbetaling' THEN 'Wanbetaling'
    WHEN 'stoppen_onderneming' THEN 'Overlijden of stoppen onderneming' ELSE 'Overig' END;

  IF coalesce(array_length(_contract_ids,1),0) > 0 THEN
    SELECT pe.* INTO p FROM public.personen pe JOIN public.persoon_onderneming po ON po.persoon_id = pe.id
      WHERE po.onderneming_id = o.id ORDER BY (pe.id = _persoon_id) DESC, po.created_at LIMIT 1;
    INSERT INTO public.klant_service_aanvragen (type, voornaam, achternaam, email, telefoon, polisnummer, details, status, onderneming_id, is_test, geverifieerd)
    VALUES ('opzeggen', coalesce(p.voornaam,''), coalesce(p.achternaam,''), coalesce(p.email_weergave,''), '', '',
      jsonb_build_object('opzegdatum', _einddatum, 'bron', 'beheer_handmatig', 'reden', _reden, 'reden_label', v_label, 'toelichting', _toelichting, 'bedrijfsnaam', o.naam),
      'in_behandeling', o.id, o.is_test, true)
    RETURNING id INTO v_aid;
    UPDATE public.klant_service_aanvragen SET onderneming_id = o.id, koppeling_status = 'zeker', koppeling_methode = 'handmatig_beheer' WHERE id = v_aid;
    FOR r IN SELECT * FROM public.klant_contracten WHERE id = ANY(_contract_ids) FOR UPDATE LOOP
      IF r.onderneming_id <> o.id THEN RAISE EXCEPTION 'contractregel hoort niet bij deze klant'; END IF;
      IF r.status NOT IN ('actief','loopt_af') THEN RAISE EXCEPTION 'contractregel % is niet actief', r.bron_rij; END IF;
      UPDATE public.klant_contracten SET eind_datum = _einddatum, status = 'loopt_af',
        afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(_einddatum,'DD-MM-YYYY'))
       WHERE id = r.id;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
      VALUES ('klant_contracten', r.id, 'handmatig_beeindigd', 'eind_datum/status',
        coalesce(r.eind_datum::text,'-') || ' / ' || r.status, _einddatum::text || ' / loopt_af',
        auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('aanvraag_id', v_aid, 'bron_rij', r.bron_rij, 'reden', _reden));
      credits := credits || jsonb_build_array(jsonb_build_object('bron_rij', r.bron_rij, 'product', r.product) || public.plan_opzeg_credit(r.id, v_aid, _einddatum));
      v_regels := v_regels || E'\n- contractregel ' || r.bron_rij || ' (' || r.product || ')';
      n := n + 1;
    END LOOP;
    IF n <> array_length(_contract_ids,1) THEN RAISE EXCEPTION 'niet alle contractregels gevonden'; END IF;
    UPDATE public.klant_service_aanvragen SET opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(), status = 'afgerond' WHERE id = v_aid;
  END IF;

  IF coalesce(array_length(_policy_ids,1),0) > 0 THEN
    FOR r IN SELECT * FROM public.policies WHERE id = ANY(_policy_ids) FOR UPDATE LOOP
      IF NOT (r.onderneming_id = o.id OR (r.onderneming_id IS NULL AND EXISTS (
          SELECT 1 FROM public.persoon_bron_koppeling k JOIN public.persoon_onderneming po ON po.persoon_id = k.persoon_id
           WHERE k.bron_tabel = 'leads' AND k.bron_id = r.lead_id AND po.onderneming_id = o.id))) THEN
        RAISE EXCEPTION 'polis hoort niet bij deze klant';
      END IF;
      IF r.status <> 'geldig' THEN RAISE EXCEPTION 'polis % is niet actief', r.certificate_number; END IF;
      UPDATE public.policies SET status = 'ingetrokken', ingetrokken_op = now(), ingetrokken_door = auth.uid(),
        intrek_reden = 'Beeindigd per ' || to_char(_einddatum,'DD-MM-YYYY') || ': ' || v_label || '. ' || btrim(_toelichting)
       WHERE id = r.id;
      INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
      VALUES ('policies', r.id, 'handmatig_beeindigd', 'status', r.status, 'ingetrokken', auth.uid(), public.get_user_role_label(auth.uid()),
        jsonb_build_object('einddatum', _einddatum, 'reden', _reden, 'aanvraag_id', v_aid));
      v_regels := v_regels || E'\n- polis ' || coalesce(r.certificate_number,'zonder nummer');
      np := np + 1;
    END LOOP;
    IF np <> array_length(_policy_ids,1) THEN RAISE EXCEPTION 'niet alle polissen gevonden'; END IF;
  END IF;

  v_tekst := 'Beeindigd per ' || to_char(_einddatum,'DD-MM-YYYY') || E'\nReden: ' || v_label || E'\nToelichting: ' || btrim(_toelichting) || v_regels;
  v_notitie := public.crm_notitie_toevoegen(o.id, _persoon_id, 'stop', v_tekst,
    jsonb_build_object('aanvraag_id', v_aid, 'einddatum', _einddatum, 'reden', _reden, 'credits', credits));
  RETURN jsonb_build_object('ok', true, 'aanvraag_id', v_aid, 'notitie_id', v_notitie, 'contracten', n, 'polissen', np, 'credits', credits);
END $$;

CREATE OR REPLACE FUNCTION public.crm_ondernemingswijziging(_van uuid, _naar uuid, _naam text, _kvk text, _rechtsvorm text,
  _ingangsdatum date, _soort text, _toelichting text, _beeindigen boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ondernemingen; v_naar uuid := _naar; v_opv uuid; v_stop jsonb; v_c uuid[]; v_p uuid[]; v_notitie uuid; v_naam text;
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _van;
  IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF _ingangsdatum IS NULL THEN RAISE EXCEPTION 'ingangsdatum is verplicht'; END IF;
  IF _soort NOT IN ('rechtsvormwijziging','overname','overig') THEN RAISE EXCEPTION 'ongeldige soort'; END IF;
  IF v_naar IS NULL THEN
    IF length(btrim(coalesce(_naam,''))) < 2 THEN RAISE EXCEPTION 'naam nieuwe onderneming is verplicht'; END IF;
    IF nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),'') IS NOT NULL AND length(regexp_replace(_kvk,'\D','','g')) <> 8 THEN RAISE EXCEPTION 'KvK-nummer moet 8 cijfers zijn'; END IF;
    INSERT INTO public.ondernemingen (naam, kvk, rechtsvorm, is_test, bron, branche, sector)
    VALUES (btrim(_naam), nullif(regexp_replace(coalesce(_kvk,''),'\D','','g'),''), nullif(btrim(coalesce(_rechtsvorm,'')),''), o.is_test, 'ondernemingswijziging', o.branche, o.sector)
    RETURNING id INTO v_naar;
  ELSIF v_naar = _van THEN RAISE EXCEPTION 'kies een andere onderneming';
  END IF;
  SELECT naam INTO v_naam FROM public.ondernemingen WHERE id = v_naar;
  INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test)
  VALUES (_van, v_naar, _ingangsdatum, _soort, nullif(btrim(coalesce(_toelichting,'')),''), auth.uid(), o.is_test) RETURNING id INTO v_opv;
  INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT persoon_id, v_naar FROM public.persoon_onderneming WHERE onderneming_id = _van ON CONFLICT DO NOTHING;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('onderneming_opvolging', v_opv, 'ondernemingswijziging', 'naar_onderneming_id', _van::text, v_naar::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('ingangsdatum', _ingangsdatum, 'soort', _soort, 'beeindigen', _beeindigen));
  v_notitie := public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
    'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce(E'\nToelichting: ' || nullif(btrim(coalesce(_toelichting,'')),''), ''),
    jsonb_build_object('opvolging_id', v_opv, 'naar_onderneming_id', v_naar));
  IF _beeindigen THEN
    SELECT array_agg(id) INTO v_c FROM public.klant_contracten WHERE onderneming_id = _van AND status IN ('actief','loopt_af') AND (eind_datum IS NULL OR eind_datum > _ingangsdatum);
    SELECT array_agg(id) INTO v_p FROM public.policies WHERE onderneming_id = _van AND status = 'geldig';
    IF coalesce(array_length(v_c,1),0) + coalesce(array_length(v_p,1),0) > 0 THEN
      v_stop := public.crm_beeindig(_van, coalesce(v_c,'{}'), coalesce(v_p,'{}'), _ingangsdatum - 1, 'ondernemingswijziging',
        'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce('. ' || nullif(btrim(coalesce(_toelichting,'')),''), ''));
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar, 'opvolging_id', v_opv, 'notitie_id', v_notitie, 'stop', v_stop);
END $$;

REVOKE ALL ON FUNCTION public.mag_crm_beeindigen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_notitie_toevoegen(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_notitie_intrekken(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_beeindig(uuid, uuid[], uuid[], date, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mag_crm_beeindigen(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_notitie_toevoegen(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_notitie_intrekken(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_beeindig(uuid, uuid[], uuid[], date, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean) TO authenticated, service_role;