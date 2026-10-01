ALTER TABLE public.klant_service_aanvragen
  ADD COLUMN IF NOT EXISTS onderneming_id uuid REFERENCES public.ondernemingen(id),
  ADD COLUMN IF NOT EXISTS koppeling_status text,
  ADD COLUMN IF NOT EXISTS koppeling_methode text,
  ADD COLUMN IF NOT EXISTS koppeling_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS opzegging_verwerkt_op timestamptz,
  ADD COLUMN IF NOT EXISTS opzegging_verwerkt_door uuid;

COMMENT ON COLUMN public.klant_service_aanvragen.koppeling_status IS 'zeker | voorstel | niet_gekoppeld (alleen type opzeggen)';

-- Bepaalt de klantkoppeling voor een opzegging: e-mail -> contractnummer -> KvK/bedrijfsnaam (voorstel).
CREATE OR REPLACE FUNCTION public.bepaal_opzegging_koppeling(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE a public.klant_service_aanvragen; ids uuid[]; v_naam text; v_kvk text; best record;
  v_status text; v_methode text; v_ond uuid; v_det jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _id;
  IF a.id IS NULL OR a.type <> 'opzeggen' THEN RETURN NULL; END IF;
  IF a.opzegging_verwerkt_op IS NOT NULL THEN RETURN jsonb_build_object('status', a.koppeling_status); END IF;
  v_naam := nullif(btrim(a.details->>'bedrijfsnaam'), '');
  v_kvk := nullif(regexp_replace(coalesce(a.details->>'kvk',''), '\D', '', 'g'), '');

  -- 1. e-mail -> persoon -> onderneming (met contracten)
  SELECT array_agg(DISTINCT o.id) INTO ids FROM public.personen p
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE p.genormaliseerd_email = lower(btrim(a.email))
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status IN ('actief','loopt_af'));
  IF coalesce(array_length(ids,1),0) = 1 THEN
    v_status := 'zeker'; v_methode := 'email'; v_ond := ids[1];
  ELSIF coalesce(array_length(ids,1),0) > 1 THEN
    v_det := jsonb_build_object('email_kandidaten', to_jsonb(ids));
  END IF;

  -- 2. polis-/contractnummer -> klant_contracten.abonnement_nr
  IF v_ond IS NULL AND nullif(btrim(a.polisnummer),'') IS NOT NULL THEN
    SELECT array_agg(DISTINCT k.onderneming_id) INTO ids FROM public.klant_contracten k
     WHERE upper(btrim(k.abonnement_nr)) = upper(btrim(a.polisnummer)) AND k.status IN ('actief','loopt_af');
    IF coalesce(array_length(ids,1),0) = 1 THEN
      v_status := 'zeker'; v_methode := 'contractnummer'; v_ond := ids[1];
    END IF;
  END IF;

  -- Meerdere klanten op e-mail: voorstel met de eerste
  IF v_ond IS NULL AND v_det ? 'email_kandidaten' THEN
    v_status := 'voorstel'; v_methode := 'email_meerdere'; v_ond := (v_det->'email_kandidaten'->>0)::uuid;
  END IF;

  -- 3. KvK of bedrijfsnaam (fuzzy) -> alleen voorstel
  IF v_ond IS NULL AND v_kvk IS NOT NULL THEN
    SELECT o.id INTO v_ond FROM public.ondernemingen o WHERE o.kvk = v_kvk
      AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status IN ('actief','loopt_af')) LIMIT 1;
    IF v_ond IS NOT NULL THEN v_status := 'voorstel'; v_methode := 'kvk'; END IF;
  END IF;
  IF v_ond IS NULL AND v_naam IS NOT NULL THEN
    SELECT o.id, similarity(lower(o.naam), lower(v_naam)) s INTO best FROM public.ondernemingen o
     WHERE o.naam IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status IN ('actief','loopt_af'))
     ORDER BY similarity(lower(o.naam), lower(v_naam)) DESC LIMIT 1;
    IF best.id IS NOT NULL AND best.s >= 0.4 THEN
      v_status := 'voorstel'; v_methode := 'bedrijfsnaam'; v_ond := best.id;
      v_det := v_det || jsonb_build_object('gelijkenis', round(best.s::numeric, 2));
    END IF;
  END IF;

  IF v_ond IS NULL THEN v_status := 'niet_gekoppeld'; v_methode := NULL; END IF;
  UPDATE public.klant_service_aanvragen SET onderneming_id = v_ond, koppeling_status = v_status,
    koppeling_methode = v_methode, koppeling_details = v_det WHERE id = _id;
  RETURN jsonb_build_object('status', v_status, 'methode', v_methode, 'onderneming_id', v_ond);
END $$;
REVOKE ALL ON FUNCTION public.bepaal_opzegging_koppeling(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bepaal_opzegging_koppeling(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_opzegging_koppeling()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'opzeggen' THEN
    BEGIN PERFORM public.bepaal_opzegging_koppeling(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.klant_service_aanvragen SET koppeling_status = 'niet_gekoppeld' WHERE id = NEW.id;
    END;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.trg_opzegging_koppeling() FROM PUBLIC, anon, authenticated;

-- Naam begint met 'zz' zodat hij na de persoonkoppeling draait.
CREATE TRIGGER zz_opzegging_koppeling AFTER INSERT ON public.klant_service_aanvragen
  FOR EACH ROW EXECUTE FUNCTION public.trg_opzegging_koppeling();

-- Team: koppeling handmatig vastleggen (bevestigt een voorstel of kiest een klant)
CREATE OR REPLACE FUNCTION public.koppel_opzegging(_aanvraag_id uuid, _onderneming_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oud public.klant_service_aanvragen;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO oud FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'opzeggen' FOR UPDATE;
  IF oud.id IS NULL THEN RAISE EXCEPTION 'opzegging niet gevonden'; END IF;
  IF oud.opzegging_verwerkt_op IS NOT NULL THEN RAISE EXCEPTION 'opzegging is al verwerkt'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ondernemingen WHERE id = _onderneming_id) THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  UPDATE public.klant_service_aanvragen SET onderneming_id = _onderneming_id, koppeling_status = 'zeker',
    koppeling_methode = 'handmatig', koppeling_details = koppeling_details || jsonb_build_object('handmatig_door', auth.uid(), 'vorige', oud.onderneming_id)
   WHERE id = _aanvraag_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', _aanvraag_id, 'opzegging_koppelen', 'onderneming_id', oud.onderneming_id::text, _onderneming_id::text,
          auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('vorige_status', oud.koppeling_status, 'vorige_methode', oud.koppeling_methode));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.koppel_opzegging(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koppel_opzegging(uuid, uuid) TO authenticated;

-- Team: opzegging verwerken op gekozen contractregels (einddatum + loopt_af). Nooit automatisch.
CREATE OR REPLACE FUNCTION public.verwerk_opzegging(_aanvraag_id uuid, _contract_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.klant_service_aanvragen; v_datum date; r record; n int := 0;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag_id AND type = 'opzeggen' FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'opzegging niet gevonden'; END IF;
  IF a.opzegging_verwerkt_op IS NOT NULL THEN RAISE EXCEPTION 'opzegging is al verwerkt'; END IF;
  IF a.onderneming_id IS NULL OR a.koppeling_status <> 'zeker' THEN RAISE EXCEPTION 'bevestig eerst de koppeling met de klant'; END IF;
  IF coalesce(array_length(_contract_ids,1),0) = 0 THEN RAISE EXCEPTION 'kies minstens één contractregel'; END IF;
  BEGIN v_datum := (a.details->>'opzegdatum')::date; EXCEPTION WHEN OTHERS THEN v_datum := NULL; END;
  IF v_datum IS NULL THEN RAISE EXCEPTION 'opzegging heeft geen geldige opzegdatum'; END IF;
  -- Regels zoals op het formulier: niet vóór de aanvraagdatum, maximaal 180 dagen vooruit (NL-tijd)
  IF v_datum < (a.created_at AT TIME ZONE 'Europe/Amsterdam')::date
     OR v_datum > (a.created_at AT TIME ZONE 'Europe/Amsterdam')::date + 180 THEN
    RAISE EXCEPTION 'opzegdatum valt buiten de toegestane termijn';
  END IF;
  FOR r IN SELECT * FROM public.klant_contracten WHERE id = ANY(_contract_ids) FOR UPDATE LOOP
    IF r.onderneming_id <> a.onderneming_id THEN RAISE EXCEPTION 'contractregel hoort niet bij deze klant'; END IF;
    IF r.status NOT IN ('actief','loopt_af') THEN RAISE EXCEPTION 'contractregel % is niet actief', r.bron_rij; END IF;
    UPDATE public.klant_contracten SET eind_datum = v_datum, status = 'loopt_af',
      afwijkingen = array_append(array_remove(afwijkingen, 'opgezegd per ' || to_char(v_datum,'DD-MM-YYYY')), 'opgezegd per ' || to_char(v_datum,'DD-MM-YYYY'))
     WHERE id = r.id;
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('klant_contracten', r.id, 'opzegging_verwerken', 'eind_datum/status',
      coalesce(r.eind_datum::text,'—') || ' / ' || r.status, v_datum::text || ' / loopt_af',
      auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('aanvraag_id', a.id, 'bron_rij', r.bron_rij));
    n := n + 1;
  END LOOP;
  IF n <> array_length(_contract_ids,1) THEN RAISE EXCEPTION 'niet alle contractregels gevonden'; END IF;
  UPDATE public.klant_service_aanvragen SET opzegging_verwerkt_op = now(), opzegging_verwerkt_door = auth.uid(),
    status = CASE WHEN status IN ('nieuw','in_behandeling') THEN 'afgehandeld' ELSE status END WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'regels', n, 'einddatum', v_datum);
END $$;
REVOKE ALL ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verwerk_opzegging(uuid, uuid[]) TO authenticated;

-- Eén bron voor dashboardtellers (CRM)
CREATE OR REPLACE FUNCTION public.dashboard_tellers(_toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; t_week timestamptz; t_maand timestamptz;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _toon_test AND NOT public.is_supervisor_or_admin(auth.uid()) THEN _toon_test := false; END IF;
  t_week := date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  t_maand := date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  WITH k AS (
    SELECT k.* FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
     WHERE k.status IN ('actief','loopt_af') AND (_toon_test OR (NOT k.is_test AND NOT o.is_test))
  ), l AS (SELECT * FROM public.leads WHERE _toon_test OR NOT is_test),
  oz AS (SELECT * FROM public.klant_service_aanvragen WHERE type = 'opzeggen' AND opzegging_verwerkt_op IS NULL AND (_toon_test OR NOT is_test))
  SELECT jsonb_build_object(
    'klanten', (SELECT count(DISTINCT onderneming_id) FROM k),
    'contracten_actief', (SELECT count(*) FROM k),
    'mrr', (SELECT round(coalesce(sum(CASE WHEN cyclus = 'jaar' THEN bedrag_per_periode*aantal/12 ELSE bedrag_per_periode*aantal END),0),2) FROM k),
    'leads_totaal', (SELECT count(*) FROM l),
    'leads_week', (SELECT count(*) FROM l WHERE created_at >= t_week),
    'leads_maand', (SELECT count(*) FROM l WHERE created_at >= t_maand),
    'leads_omgezet', (SELECT count(*) FROM l WHERE status IN ('actief','klant')),
    'opzeggingen_te_koppelen', (SELECT count(*) FROM oz WHERE coalesce(koppeling_status,'niet_gekoppeld') IN ('voorstel','niet_gekoppeld')),
    'opzeggingen_te_verwerken', (SELECT count(*) FROM oz WHERE koppeling_status = 'zeker'),
    'toon_test', _toon_test
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.dashboard_tellers(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_tellers(boolean) TO authenticated;

-- Bestaande opzeggingen eenmalig koppelen (alleen koppelvelden, geen contractwijziging)
DO $$ DECLARE x uuid; BEGIN
  FOR x IN SELECT id FROM public.klant_service_aanvragen WHERE type = 'opzeggen' AND koppeling_status IS NULL LOOP
    PERFORM public.bepaal_opzegging_koppeling(x);
  END LOOP;
END $$;