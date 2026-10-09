-- Eén plek voor de nummerkeuze van een nieuw verzekeringscertificaat.
-- Volgorde: overgenomen (onderneming_opvolging), bevestigd (bav_nummer_bevestigingen), klant_certificaten 'bevestigd', eerdere policy.
-- Nooit een nummer dat op een geldige policy van een andere onderneming staat.
CREATE OR REPLACE FUNCTION public.certificaatnummer_voorstel_intern(_onderneming_id uuid, _lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ond uuid := _onderneming_id; r record; p record; v_n int;
BEGIN
  IF v_ond IS NULL AND _lead_id IS NOT NULL THEN
    SELECT count(DISTINCT po.onderneming_id), min(po.onderneming_id::text)::uuid INTO v_n, v_ond
      FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id
     WHERE k.bron_tabel = 'leads' AND k.bron_id = _lead_id;
    IF v_n <> 1 THEN v_ond := NULL; END IF;
  END IF;

  FOR r IN
    SELECT * FROM (
      SELECT 1 prio, 'overgenomen' bron, upper(btrim(o.bav_nummer)) nummer, o.vastgelegd_op datum, o.vastgelegd_door door
        FROM onderneming_opvolging o
       WHERE coalesce(btrim(o.bav_nummer),'') <> '' AND NOT o.is_test
         AND ((v_ond IS NOT NULL AND o.naar_onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND o.lead_id = _lead_id))
      UNION ALL
      SELECT 2, 'bevestigd', upper(btrim(b.nummer)), b.bevestigd_op, b.bevestigd_door
        FROM bav_nummer_bevestigingen b WHERE v_ond IS NOT NULL AND b.onderneming_id = v_ond
      UNION ALL
      SELECT 3, 'klant_certificaat', upper(btrim(c.certificaatnummer)), coalesce(c.beoordeeld_op, c.aanvraagdatum::timestamptz), c.beoordeeld_door
        FROM klant_certificaten c WHERE v_ond IS NOT NULL AND c.onderneming_id = v_ond AND c.koppeling_status = 'bevestigd' AND NOT c.is_test
      UNION ALL
      SELECT 4, 'eerdere_policy', upper(btrim(pp.certificate_number)), pp.created_at, NULL::uuid
        FROM policies pp WHERE (v_ond IS NOT NULL AND pp.onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND pp.lead_id = _lead_id)
    ) x
    WHERE x.nummer ~ '^ZPBAV[0-9]+$'
    ORDER BY prio, datum DESC NULLS LAST
  LOOP
    SELECT id, onderneming_id, lead_id, status INTO p FROM policies WHERE upper(certificate_number) = r.nummer LIMIT 1;
    -- Op een geldige policy van een andere klant: nooit gebruiken, volgende bron proberen.
    IF p.id IS NOT NULL AND p.status = 'geldig'
       AND NOT ((v_ond IS NOT NULL AND p.onderneming_id = v_ond) OR (_lead_id IS NOT NULL AND p.lead_id = _lead_id)) THEN
      CONTINUE;
    END IF;
    RETURN jsonb_build_object('nummer', r.nummer, 'bron', r.bron, 'datum', r.datum,
      'door_naam', (SELECT full_name FROM profiles WHERE id = r.door), 'onderneming_id', v_ond,
      'staat_al_op_policy', p.id IS NOT NULL, 'policy_status', p.status);
  END LOOP;
  RETURN jsonb_build_object('nummer', NULL, 'bron', 'geen', 'onderneming_id', v_ond);
END $$;
REVOKE ALL ON FUNCTION public.certificaatnummer_voorstel_intern(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.certificaatnummer_voorstel_intern(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.certificaatnummer_voorstel(_onderneming_id uuid, _lead_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN public.certificaatnummer_voorstel_intern(_onderneming_id, _lead_id);
END $$;
REVOKE ALL ON FUNCTION public.certificaatnummer_voorstel(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.certificaatnummer_voorstel(uuid, uuid) TO authenticated, service_role;

-- Trigger: leeg nummer = bekend nummer van de klant; 'NIEUW' = expliciet nieuw nummer.
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; vrij bigint; v jsonb;
BEGIN
  IF upper(coalesce(NEW.certificate_number,'')) = 'NIEUW' THEN
    NEW.certificate_number := '';
  ELSIF coalesce(NEW.certificate_number,'') = '' THEN
    v := public.certificaatnummer_voorstel_intern(NEW.onderneming_id, NEW.lead_id);
    IF NEW.onderneming_id IS NULL AND (v->>'onderneming_id') IS NOT NULL THEN
      NEW.onderneming_id := (v->>'onderneming_id')::uuid;
    END IF;
    IF v->>'nummer' IS NOT NULL THEN
      IF (v->>'staat_al_op_policy')::boolean THEN
        RAISE EXCEPTION 'Nummer % (%) staat al op een certificaat van deze klant. Gebruik Aanpassen, of kies expliciet een nieuw nummer.', v->>'nummer', v->>'bron';
      END IF;
      NEW.certificate_number := v->>'nummer';
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  n := nextval('public.policy_cert_seq');
  vrij := public.eerste_vrije_certificaatnummer(n);
  IF vrij > n THEN PERFORM setval('public.policy_cert_seq', vrij); END IF;
  NEW.certificate_number := 'ZPBAV' || vrij::text;
  RETURN NEW;
END $$;