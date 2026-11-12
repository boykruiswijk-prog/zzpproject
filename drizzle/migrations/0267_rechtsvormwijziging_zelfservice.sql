ALTER TABLE public.klant_service_aanvragen DROP CONSTRAINT klant_service_aanvragen_type_check;
ALTER TABLE public.klant_service_aanvragen ADD CONSTRAINT klant_service_aanvragen_type_check CHECK (type = ANY (ARRAY['certificaat','pauzeren','documenten','opzeggen','portaltoegang','factuur_opvragen','rechtsvormwijziging']));

-- Besluit Boy 12-11-2026 11:39: team keurt een zelfservice-rechtsvormwijziging goed. Hergebruikt crm_ondernemingswijziging
-- (opvolging, beeindigen per dag voor ingangsdatum met bestaande creditregels, contract_meenemen_kern zonder dubbele factuur);
-- de polis gaat daarna via generate-certificate actie omzetten (polis_omzetten). Nooit mail, nooit Exact.
CREATE OR REPLACE FUNCTION public.rechtsvormwijziging_goedkeuren(_aanvraag uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.klant_service_aanvragen; d jsonb; n jsonb; v_van uuid; v_naar uuid; v_ingang date; v_eind date; v_res jsonb; v_kop uuid;
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT (public.is_team_member(auth.uid()) AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _aanvraag FOR UPDATE;
  IF a.id IS NULL OR a.type <> 'rechtsvormwijziging' THEN RAISE EXCEPTION 'verzoek niet gevonden'; END IF;
  IF a.status NOT IN ('nieuw','in_behandeling') OR a.details ? 'goedgekeurd' THEN RAISE EXCEPTION 'verzoek is al afgehandeld'; END IF;
  d := a.details; n := d->'nieuw'; v_van := a.onderneming_id;
  v_ingang := (d->>'ingangsdatum')::date; v_eind := (d->>'einddatum')::date;
  IF v_van IS NULL THEN RAISE EXCEPTION 'huidige onderneming onbekend'; END IF;
  IF v_ingang IS NULL OR v_eind IS NULL OR v_ingang - v_eind NOT IN (0,1) THEN RAISE EXCEPTION 'einddatum en ingangsdatum sluiten niet aan'; END IF;
  SELECT id INTO v_naar FROM public.ondernemingen WHERE kvk = n->>'kvk' AND samengevoegd_naar IS NULL AND id <> v_van AND NOT is_test ORDER BY created_at LIMIT 1;
  v_res := public.crm_ondernemingswijziging(v_van, v_naar, n->>'naam', n->>'kvk', n->>'rechtsvorm', v_ingang, 'rechtsvormwijziging',
    'Zelfservice Mijn ZP, verzoek ' || left(a.id::text, 8) || coalesce(', machtiging ' || (d->>'mandaatkenmerk'), ''), true, true);
  v_naar := (v_res->>'naar_onderneming_id')::uuid;
  UPDATE public.ondernemingen SET straat = coalesce(straat, n->>'straat'), huisnummer = coalesce(huisnummer, n->>'huisnummer'),
    postcode = coalesce(postcode, n->>'postcode'), plaats = coalesce(plaats, n->>'plaats'), rechtsvorm = coalesce(rechtsvorm, n->>'rechtsvorm')
  WHERE id = v_naar;
  INSERT INTO public.onderneming_koppelingen (vorige_onderneming_id, nieuwe_onderneming_id, reden, vastgelegd_door, is_test)
  VALUES (v_van, v_naar, 'Rechtsvormwijziging via Mijn ZP, verzoek ' || left(a.id::text, 8), auth.uid(), a.is_test)
  ON CONFLICT (vorige_onderneming_id, nieuwe_onderneming_id) DO NOTHING RETURNING id INTO v_kop;
  UPDATE public.klant_service_aanvragen SET status = 'in_behandeling', behandeld_door = auth.uid(), behandeld_op = now(),
    details = details || jsonb_build_object('goedgekeurd', jsonb_build_object('op', now(), 'door', auth.uid(), 'naar_onderneming_id', v_naar, 'opvolging_id', v_res->>'opvolging_id', 'koppeling_id', v_kop))
  WHERE id = a.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('klant_service_aanvragen', a.id, 'rechtsvormwijziging_goedgekeurd', 'onderneming_id', v_van::text, v_naar::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('ingangsdatum', v_ingang, 'einddatum', v_eind, 'polis_id', d->>'polis_id', 'koppeling_id', v_kop));
  RETURN jsonb_build_object('naar_onderneming_id', v_naar, 'opvolging_id', v_res->>'opvolging_id', 'polis_id', d->>'polis_id', 'ingangsdatum', v_ingang);
END $$;
REVOKE ALL ON FUNCTION public.rechtsvormwijziging_goedkeuren(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechtsvormwijziging_goedkeuren(uuid) TO authenticated, service_role;

-- Afronden nadat de polis is omgezet (of als er niets om te zetten was).
CREATE OR REPLACE FUNCTION public.rechtsvormwijziging_afronden(_aanvraag uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT (public.is_team_member(auth.uid()) AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  UPDATE public.klant_service_aanvragen SET status = 'afgerond', behandeld_door = auth.uid(), behandeld_op = now()
  WHERE id = _aanvraag AND type = 'rechtsvormwijziging' AND details ? 'goedgekeurd';
  IF NOT FOUND THEN RAISE EXCEPTION 'verzoek is nog niet goedgekeurd'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.rechtsvormwijziging_afronden(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechtsvormwijziging_afronden(uuid) TO authenticated, service_role;

-- Klant leest de status van eigen verzoeken (alleen eigen user_id, geen bankgegevens).
CREATE OR REPLACE FUNCTION public.mijn_rechtsvormwijzigingen()
RETURNS TABLE (id uuid, status text, polisnummer text, einddatum text, ingangsdatum text, nieuwe_naam text, aangemaakt timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT k.id, k.status, k.polisnummer, k.details->>'einddatum', k.details->>'ingangsdatum', k.details->'nieuw'->>'naam', k.created_at
  FROM public.klant_service_aanvragen k WHERE k.type = 'rechtsvormwijziging' AND k.user_id = auth.uid() ORDER BY k.created_at DESC LIMIT 20
$$;
REVOKE ALL ON FUNCTION public.mijn_rechtsvormwijzigingen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_rechtsvormwijzigingen() TO authenticated;