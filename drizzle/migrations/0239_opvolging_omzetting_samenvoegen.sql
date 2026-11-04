-- A. Kern van de omzetting, gedeeld door team-RPC en eenmalige systeemopdracht.
CREATE OR REPLACE FUNCTION public.polis_omzetten_kern(_policy_id uuid, _naar uuid, _ingangsdatum date, _reden text, _lead_id uuid, _oude_pdf_pad text, _door uuid, _door_email text, _door_naam text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.policies; v_van uuid; vo public.ondernemingen; nn public.ondernemingen; v_pers int; v_uid uuid;
BEGIN
  IF _door IS NULL THEN RAISE EXCEPTION 'uitvoerder ontbreekt'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 10 THEN RAISE EXCEPTION 'geef een toelichting (minimaal 10 tekens)'; END IF;
  IF _ingangsdatum IS NULL THEN RAISE EXCEPTION 'kies de ingangsdatum van de BV'; END IF;
  SELECT * INTO p FROM public.policies WHERE id = _policy_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'certificaat niet gevonden'; END IF;
  IF p.status <> 'geldig' THEN RAISE EXCEPTION 'certificaat is ingetrokken'; END IF;
  v_van := coalesce(p.onderneming_id, (SELECT l.gekoppeld_onderneming_id FROM public.leads l WHERE l.id = p.lead_id));
  SELECT * INTO vo FROM public.ondernemingen WHERE id = v_van;
  SELECT * INTO nn FROM public.ondernemingen WHERE id = _naar;
  IF vo.id IS NULL THEN RAISE EXCEPTION 'certificaat hangt niet aan een klant'; END IF;
  IF nn.id IS NULL THEN RAISE EXCEPTION 'nieuwe onderneming niet gevonden'; END IF;
  IF nn.id = vo.id THEN RAISE EXCEPTION 'voorganger en opvolger zijn dezelfde onderneming'; END IF;
  IF nn.samengevoegd_naar IS NOT NULL THEN RAISE EXCEPTION 'nieuwe onderneming is samengevoegd; kies de hoofdkaart'; END IF;
  IF nn.is_test IS DISTINCT FROM vo.is_test THEN RAISE EXCEPTION 'test en echt niet door elkaar'; END IF;
  IF public.onderneming_is_partner(vo.id) IS NOT NULL THEN RAISE EXCEPTION 'voorganger komt via partner: BAV-nummer niet overnemen'; END IF;
  IF EXISTS (SELECT 1 FROM public.policies x WHERE x.onderneming_id = nn.id AND x.status = 'geldig' AND x.id <> p.id) THEN
    RAISE EXCEPTION 'de nieuwe onderneming heeft al een geldig certificaat'; END IF;

  INSERT INTO public.policy_versies (policy_id, certificate_number, versie, actie, oude_waarden, nieuwe_waarden, oude_pdf_pad, reden, uitgevoerd_door, uitgevoerd_door_email)
  VALUES (p.id, p.certificate_number, p.versie, 'omgezet',
    jsonb_build_object('onderneming_id', vo.id, 'lead_id', p.lead_id, 'certificate_holder', p.certificate_holder, 'insured_name', p.insured_name,
      'start_date', p.start_date, 'issued_date', p.issued_date, 'versie', p.versie, 'status', 'vervangen'),
    jsonb_build_object('onderneming_id', nn.id, 'lead_id', _lead_id, 'certificate_holder', nn.naam, 'insured_name', nn.naam, 'start_date', _ingangsdatum, 'versie', p.versie + 1),
    _oude_pdf_pad, 'Omzetting naar ' || nn.naam || ': ' || btrim(_reden), _door, _door_email);

  UPDATE public.policies SET onderneming_id = nn.id, lead_id = _lead_id, certificate_holder = nn.naam, insured_name = nn.naam,
    start_date = _ingangsdatum, issued_date = (now() AT TIME ZONE 'Europe/Amsterdam')::date, versie = versie + 1
   WHERE id = p.id;

  INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test, bav_nummer, bav_nummer_herkomst, lead_id)
  VALUES (vo.id, nn.id, _ingangsdatum, 'rechtsvormwijziging', btrim(_reden), _door, coalesce(nn.is_test,false), p.certificate_number, 'zp', _lead_id)
  ON CONFLICT (van_onderneming_id, naar_onderneming_id) DO UPDATE SET bav_nummer = EXCLUDED.bav_nummer, bav_nummer_herkomst = EXCLUDED.bav_nummer_herkomst, ingangsdatum = EXCLUDED.ingangsdatum, lead_id = coalesce(public.onderneming_opvolging.lead_id, EXCLUDED.lead_id);

  WITH ins AS (INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT po.persoon_id, nn.id FROM public.persoon_onderneming po WHERE po.onderneming_id = vo.id
    ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) INTO v_pers FROM ins;

  IF (SELECT user_id FROM public.policies WHERE id = p.id) IS NULL THEN
    v_uid := public.portal_user_voor_onderneming(nn.id);
    IF v_uid IS NOT NULL THEN UPDATE public.policies SET user_id = v_uid WHERE id = p.id; END IF;
  END IF;

  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
  VALUES ('policies', p.id, 'polis_omgezet', 'onderneming_id', vo.id::text, nn.id::text, _door, _door_email, 'team',
    jsonb_build_object('certificaatnummer', p.certificate_number, 'van', vo.naam, 'naar', nn.naam, 'ingangsdatum', _ingangsdatum, 'reden', btrim(_reden), 'lead_id', _lead_id, 'personen_gekoppeld', v_pers, 'oude_pdf_pad', _oude_pdf_pad));
  INSERT INTO public.crm_notities (onderneming_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (vo.id, 'overig', coalesce(vo.is_test,false), 'Omgezet naar ' || nn.naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '; certificaat ' || p.certificate_number || ' staat nu op de nieuwe onderneming (oude versie bewaard). Reden: ' || btrim(_reden), _door, coalesce(_door_naam,'team'), jsonb_build_object('soort','omzetting','policy_id',p.id)),
         (nn.id, 'overig', coalesce(nn.is_test,false), 'Omzetting van ' || vo.naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '; certificaat ' || p.certificate_number || ' overgenomen. Contracten en facturatie zijn niet gewijzigd. Reden: ' || btrim(_reden), _door, coalesce(_door_naam,'team'), jsonb_build_object('soort','omzetting','policy_id',p.id));
  RETURN jsonb_build_object('ok', true, 'certificaatnummer', p.certificate_number, 'versie', p.versie + 1, 'personen_gekoppeld', v_pers);
END $function$;
REVOKE ALL ON FUNCTION public.polis_omzetten_kern(uuid, uuid, date, text, uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.polis_omzetten_kern(uuid, uuid, date, text, uuid, text, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.polis_omzetten(_policy_id uuid, _naar uuid, _ingangsdatum date, _reden text, _lead_id uuid, _oude_pdf_pad text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); v_email text; v_naam text;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = me;
  SELECT nullif(btrim(coalesce(full_name,'')),'') INTO v_naam FROM public.profiles WHERE id = me;
  RETURN public.polis_omzetten_kern(_policy_id, _naar, _ingangsdatum, _reden, _lead_id, _oude_pdf_pad, me, v_email, v_naam);
END $function$;
REVOKE ALL ON FUNCTION public.polis_omzetten(uuid, uuid, date, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.polis_omzetten(uuid, uuid, date, text, uuid, text) TO authenticated;

-- B. Eenmalige systeemopdrachten (besluit vastgelegd, eenmalig token, alleen service_role; nooit mail).
CREATE TABLE IF NOT EXISTS public.omzetting_systeem_opdrachten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  policy_id uuid NOT NULL REFERENCES public.policies(id),
  naar_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  ingangsdatum date NOT NULL,
  reden text NOT NULL CHECK (length(btrim(reden)) >= 10),
  lead_id uuid,
  door uuid NOT NULL,
  door_email text,
  door_naam text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  verloopt_op timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  gebruikt_op timestamptz
);
GRANT ALL ON public.omzetting_systeem_opdrachten TO service_role;
ALTER TABLE public.omzetting_systeem_opdrachten ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.omzetting_systeem_claim(_token text)
 RETURNS public.omzetting_systeem_opdrachten LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.omzetting_systeem_opdrachten;
BEGIN
  UPDATE public.omzetting_systeem_opdrachten SET gebruikt_op = now()
   WHERE token_hash = encode(extensions.digest(coalesce(_token,''), 'sha256'), 'hex') AND gebruikt_op IS NULL AND verloopt_op > now()
  RETURNING * INTO r;
  RETURN r;
END $function$;
REVOKE ALL ON FUNCTION public.omzetting_systeem_claim(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omzetting_systeem_claim(text) TO service_role;

-- C. Opvolging vastleggen met polis meenemen: polissen niet beeindigen en geen taak "polis kan niet worden overgezet".
DROP FUNCTION IF EXISTS public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean);
CREATE FUNCTION public.crm_ondernemingswijziging(_van uuid, _naar uuid, _naam text, _kvk text, _rechtsvorm text, _ingangsdatum date, _soort text, _toelichting text, _beeindigen boolean DEFAULT true, _polis_meenemen boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.ondernemingen; v_naar uuid := _naar; v_opv uuid; v_stop jsonb; v_c uuid[]; v_p uuid[]; v_notitie uuid; v_naam text;
  v_mee boolean := coalesce(_polis_meenemen,false) AND _soort = 'rechtsvormwijziging';
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
    jsonb_build_object('ingangsdatum', _ingangsdatum, 'soort', _soort, 'beeindigen', _beeindigen, 'polis_meenemen', v_mee));
  v_notitie := public.crm_notitie_toevoegen(_van, NULL, 'ondernemingswijziging',
    'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce(E'\nToelichting: ' || nullif(btrim(coalesce(_toelichting,'')),''), ''),
    jsonb_build_object('opvolging_id', v_opv, 'naar_onderneming_id', v_naar));
  IF _beeindigen THEN
    SELECT array_agg(id) INTO v_c FROM public.klant_contracten WHERE onderneming_id = _van AND status IN ('actief','loopt_af','einddatum_controle') AND (eind_datum IS NULL OR eind_datum > _ingangsdatum);
    IF NOT v_mee THEN SELECT array_agg(id) INTO v_p FROM public.policies WHERE onderneming_id = _van AND status = 'geldig'; END IF;
    IF coalesce(array_length(v_c,1),0) + coalesce(array_length(v_p,1),0) > 0 THEN
      v_stop := public.crm_beeindig(_van, coalesce(v_c,'{}'), coalesce(v_p,'{}'), _ingangsdatum - 1, 'ondernemingswijziging',
        'Voortgezet als ' || v_naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || coalesce('. ' || nullif(btrim(coalesce(_toelichting,'')),''), ''));
    END IF;
  END IF;
  DECLARE v_nieuw public.ondernemingen; v_had boolean; BEGIN
    SELECT * INTO v_nieuw FROM public.ondernemingen WHERE id = v_naar;
    v_had := EXISTS (SELECT 1 FROM public.klant_contracten WHERE onderneming_id = _van) OR EXISTS (SELECT 1 FROM public.policies WHERE onderneming_id = _van);
    IF NOT v_mee AND (v_nieuw.kvk IS DISTINCT FROM o.kvk OR v_had) THEN
      INSERT INTO public.crm_taken (soort, team, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
      VALUES ('nieuwe_aanvraag_nodig', 'verzekering', v_naar,
        'Nieuwe aanvraag nodig: ' || o.naam || ' gaat verder als ' || v_nieuw.naam || ' (KvK ' || coalesce(v_nieuw.kvk,'onbekend') || ') per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '. Polis kan niet worden overgezet.',
        jsonb_build_object('opvolging_id', v_opv, 'van_onderneming_id', _van, 'oude_kvk', o.kvk, 'nieuwe_kvk', v_nieuw.kvk),
        auth.uid(), coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()),'teamlid'), o.is_test OR v_nieuw.is_test);
    END IF;
  END;
  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar, 'opvolging_id', v_opv, 'notitie_id', v_notitie, 'stop', v_stop, 'polis_meenemen', v_mee);
END $function$;
REVOKE ALL ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_ondernemingswijziging(uuid, uuid, text, text, text, date, text, text, boolean, boolean) TO authenticated;