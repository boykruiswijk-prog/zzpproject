ALTER TABLE public.policy_versies DROP CONSTRAINT policy_versies_actie_check;
ALTER TABLE public.policy_versies ADD CONSTRAINT policy_versies_actie_check CHECK (actie = ANY (ARRAY['aangepast','ingetrokken','gemaild','nummer_vervangen']));

-- Overgenomen BAV-nummer (omzetting) voor een lead, als dat vrij is.
CREATE OR REPLACE FUNCTION public.overgenomen_certificaatnummer(_lead_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT btrim(o.bav_nummer) FROM public.onderneming_opvolging o
   WHERE o.lead_id = _lead_id AND coalesce(btrim(o.bav_nummer),'') <> ''
   ORDER BY o.vastgelegd_op DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.overgenomen_certificaatnummer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.overgenomen_certificaatnummer(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; vrij bigint; v_over text;
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    IF NEW.lead_id IS NOT NULL THEN
      v_over := public.overgenomen_certificaatnummer(NEW.lead_id);
      IF v_over IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.policies p WHERE p.certificate_number = v_over) THEN
        NEW.certificate_number := v_over;
        RETURN NEW;
      END IF;
    END IF;
    n := nextval('public.policy_cert_seq');
    vrij := public.eerste_vrije_certificaatnummer(n);
    IF vrij > n THEN PERFORM setval('public.policy_cert_seq', vrij); END IF;
    NEW.certificate_number := 'ZPBAV' || vrij::text;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_policy_nummer_en_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.certificate_number IS DISTINCT FROM OLD.certificate_number AND coalesce(OLD.certificate_number,'') <> ''
     AND coalesce(current_setting('app.cert_nummer_overnemen', true),'') <> 'on' THEN
    RAISE EXCEPTION 'Een certificaatnummer kan nooit gewijzigd worden';
  END IF;
  IF OLD.status = 'ingetrokken' AND NEW.status IS DISTINCT FROM 'ingetrokken' THEN
    RAISE EXCEPTION 'Een ingetrokken certificaat kan niet opnieuw geldig worden';
  END IF;
  RETURN NEW;
END $$;

-- Enige route om een nummer te vervangen: door het bij omzetting overgenomen BAV-nummer.
CREATE OR REPLACE FUNCTION public.policy_nummer_overnemen(_policy_id uuid, _oude_pdf_pad text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.policies; v_nummer text; v_naar uuid; v_email text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO p FROM public.policies WHERE id = _policy_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'certificaat niet gevonden'; END IF;
  IF p.status <> 'geldig' THEN RAISE EXCEPTION 'certificaat is ingetrokken'; END IF;
  IF p.lead_id IS NULL THEN RAISE EXCEPTION 'certificaat hoort niet bij een lead'; END IF;
  v_nummer := public.overgenomen_certificaatnummer(p.lead_id);
  IF v_nummer IS NULL THEN RAISE EXCEPTION 'geen omzetting met BAV-nummer vastgelegd voor deze lead'; END IF;
  SELECT naar_onderneming_id INTO v_naar FROM public.onderneming_opvolging WHERE lead_id = p.lead_id AND btrim(bav_nummer) = v_nummer ORDER BY vastgelegd_op DESC LIMIT 1;
  IF p.certificate_number = v_nummer THEN
    UPDATE public.policies SET onderneming_id = coalesce(onderneming_id, v_naar) WHERE id = p.id;
    RETURN jsonb_build_object('gewijzigd', false, 'nummer', v_nummer);
  END IF;
  IF EXISTS (SELECT 1 FROM public.policies WHERE certificate_number = v_nummer AND id <> p.id) THEN
    RAISE EXCEPTION 'nummer % staat al op een ander certificaat', v_nummer; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.policy_versies (policy_id, certificate_number, versie, actie, oude_waarden, nieuwe_waarden, oude_pdf_pad, reden, uitgevoerd_door, uitgevoerd_door_email)
  VALUES (p.id, p.certificate_number, p.versie, 'nummer_vervangen',
    jsonb_build_object('certificate_number', p.certificate_number, 'status', 'vervangen', 'onderneming_id', p.onderneming_id),
    jsonb_build_object('certificate_number', v_nummer, 'onderneming_id', coalesce(p.onderneming_id, v_naar), 'versie', p.versie + 1),
    _oude_pdf_pad, 'Vervangen door overgenomen BAV-nummer bij omzetting (rechtsopvolging)', auth.uid(), v_email);
  PERFORM set_config('app.cert_nummer_overnemen', 'on', true);
  UPDATE public.policies SET certificate_number = v_nummer, onderneming_id = coalesce(onderneming_id, v_naar),
    versie = versie + 1, issued_date = (now() AT TIME ZONE 'Europe/Amsterdam')::date WHERE id = p.id;
  PERFORM set_config('app.cert_nummer_overnemen', 'off', true);
  RETURN jsonb_build_object('gewijzigd', true, 'oud', p.certificate_number, 'nummer', v_nummer);
END $$;
REVOKE ALL ON FUNCTION public.policy_nummer_overnemen(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.policy_nummer_overnemen(uuid, text) TO authenticated, service_role;