CREATE TABLE public.klant_certificaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id) ON DELETE CASCADE,
  persoon_id uuid REFERENCES public.personen(id) ON DELETE SET NULL,
  certificaatnummer text NOT NULL,
  aanvraagdatum date NOT NULL,
  ingestuurd timestamp without time zone,
  pakket text,
  bron text NOT NULL DEFAULT 'zp_aanvragen_20261001',
  bron_naam text,
  bron_contact text,
  match_type text,
  koppeling_status text NOT NULL DEFAULT 'voorstel' CHECK (koppeling_status IN ('bevestigd','voorstel','afgewezen')),
  waarschuwing text,
  beoordeeld_door uuid,
  beoordeeld_op timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onderneming_id, certificaatnummer, aanvraagdatum)
);
GRANT SELECT, INSERT, UPDATE ON public.klant_certificaten TO authenticated;
GRANT ALL ON public.klant_certificaten TO service_role;
ALTER TABLE public.klant_certificaten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest klant_certificaten" ON public.klant_certificaten FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin voegt klant_certificaten in" ON public.klant_certificaten FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin wijzigt klant_certificaten" ON public.klant_certificaten FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE INDEX idx_klant_cert_nummer ON public.klant_certificaten (upper(certificaatnummer));
CREATE INDEX idx_klant_cert_ond ON public.klant_certificaten (onderneming_id);
CREATE TRIGGER trg_klant_cert_updated BEFORE UPDATE ON public.klant_certificaten FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotente import: NC bevestigd, N/C/F voorstel (F met waarschuwing), X niet.
CREATE OR REPLACE FUNCTION public.importeer_certificaten_20261001()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_voor int; v_na int;
BEGIN
  SELECT count(*) INTO v_voor FROM public.klant_certificaten WHERE bron = 'zp_aanvragen_20261001';
  INSERT INTO public.klant_certificaten (onderneming_id, persoon_id, certificaatnummer, aanvraagdatum, ingestuurd, pakket, bron,
    bron_naam, bron_contact, match_type, koppeling_status, waarschuwing, is_test)
  SELECT DISTINCT ON (o.id, upper(btrim(z.certificaatnummer)), z.ingestuurd::date)
    o.id,
    (SELECT CASE WHEN count(*) = 1 THEN min(p.id::text)::uuid END FROM public.personen p
       JOIN public.persoon_onderneming po ON po.persoon_id = p.id
      WHERE po.onderneming_id = o.id
        AND lower(btrim(concat_ws(' ', p.voornaam, p.achternaam))) = lower(btrim(z.contact))),
    upper(btrim(z.certificaatnummer)), z.ingestuurd::date, z.ingestuurd, z.bavpakket, 'zp_aanvragen_20261001',
    coalesce(z.bedrijfsnaam_afwijkend, z.naam), z.contact, z.match_type,
    CASE WHEN z.match_type = 'NC' THEN 'bevestigd' ELSE 'voorstel' END,
    CASE z.match_type WHEN 'F' THEN 'Fuzzy op naam — onbetrouwbaar, eerst controleren'
                      WHEN 'N' THEN 'Alleen bedrijfsnaam klopt' WHEN 'C' THEN 'Alleen contactpersoon klopt' END,
    o.is_test
  FROM import_cert.zp_aanvragen_20261001 z
  JOIN public.ondernemingen o ON public.exact_code_norm(o.exact_relatie_code) = public.exact_code_norm(z.exact_relatie_code)
  WHERE z.match_type IN ('NC','N','C','F')
  ORDER BY o.id, upper(btrim(z.certificaatnummer)), z.ingestuurd::date, z.ingestuurd DESC
  ON CONFLICT (onderneming_id, certificaatnummer, aanvraagdatum) DO NOTHING;
  SELECT count(*) INTO v_na FROM public.klant_certificaten WHERE bron = 'zp_aanvragen_20261001';
  RETURN jsonb_build_object('voor', v_voor, 'na', v_na, 'nieuw', v_na - v_voor);
END $$;
REVOKE ALL ON FUNCTION public.importeer_certificaten_20261001() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importeer_certificaten_20261001() TO service_role;

-- Bevestigen of afwijzen van een voorstel, met audit-log.
CREATE OR REPLACE FUNCTION public.beoordeel_klant_certificaat(_id uuid, _bevestigen boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.klant_certificaten; v_nieuw text; v_email text;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen_toegang'; END IF;
  SELECT * INTO c FROM public.klant_certificaten WHERE id = _id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'niet_gevonden'; END IF;
  IF c.koppeling_status <> 'voorstel' THEN RAISE EXCEPTION 'geen_voorstel'; END IF;
  v_nieuw := CASE WHEN _bevestigen THEN 'bevestigd' ELSE 'afgewezen' END;
  UPDATE public.klant_certificaten SET koppeling_status = v_nieuw, beoordeeld_door = auth.uid(), beoordeeld_op = now() WHERE id = _id;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, details)
  VALUES ('klant_certificaten', _id, CASE WHEN _bevestigen THEN 'certificaat_bevestigd' ELSE 'certificaat_afgewezen' END,
    'koppeling_status', 'voorstel', v_nieuw, auth.uid(), v_email,
    jsonb_build_object('certificaatnummer', c.certificaatnummer, 'onderneming_id', c.onderneming_id, 'match_type', c.match_type));
  RETURN jsonb_build_object('status', v_nieuw);
END $$;
REVOKE ALL ON FUNCTION public.beoordeel_klant_certificaat(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.beoordeel_klant_certificaat(uuid, boolean) TO authenticated, service_role;

-- Nummergenerator: eerste vrije nummer vanaf een kandidaat (raakt de reeks niet).
CREATE OR REPLACE FUNCTION public.eerste_vrije_certificaatnummer(_start bigint)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint := _start;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.policies WHERE upper(certificate_number) = 'ZPBAV' || n)
     OR EXISTS (SELECT 1 FROM public.klant_certificaten WHERE upper(certificaatnummer) = 'ZPBAV' || n) LOOP
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.eerste_vrije_certificaatnummer(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eerste_vrije_certificaatnummer(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; vrij bigint;
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    n := nextval('public.policy_cert_seq');
    vrij := public.eerste_vrije_certificaatnummer(n);
    IF vrij > n THEN PERFORM setval('public.policy_cert_seq', vrij); END IF;
    NEW.certificate_number := 'ZPBAV' || vrij::text;
  END IF;
  RETURN NEW;
END $$;

-- Opzegkoppeling: stap 2 ook op certificaatnummer; gedeeld nummer of voorstel = nooit zeker.
CREATE OR REPLACE FUNCTION public.bepaal_opzegging_koppeling(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE a public.klant_service_aanvragen; ids uuid[]; v_naam text; v_kvk text; best record;
  v_status text; v_methode text; v_ond uuid; v_det jsonb := '{}'::jsonb; v_nr text; v_bevestigd boolean;
BEGIN
  SELECT * INTO a FROM public.klant_service_aanvragen WHERE id = _id;
  IF a.id IS NULL OR a.type <> 'opzeggen' THEN RETURN NULL; END IF;
  IF a.opzegging_verwerkt_op IS NOT NULL THEN RETURN jsonb_build_object('status', a.koppeling_status); END IF;
  v_naam := nullif(btrim(a.details->>'bedrijfsnaam'), '');
  v_kvk := nullif(regexp_replace(coalesce(a.details->>'kvk',''), '\D', '', 'g'), '');
  v_nr := nullif(upper(regexp_replace(coalesce(a.polisnummer,''), '\s', '', 'g')), '');

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

  -- 2a. contractnummer -> klant_contracten.abonnement_nr
  IF v_ond IS NULL AND v_nr IS NOT NULL THEN
    SELECT array_agg(DISTINCT k.onderneming_id) INTO ids FROM public.klant_contracten k
     WHERE upper(btrim(k.abonnement_nr)) = v_nr AND k.status IN ('actief','loopt_af');
    IF coalesce(array_length(ids,1),0) = 1 THEN
      v_status := 'zeker'; v_methode := 'contractnummer'; v_ond := ids[1];
    END IF;
  END IF;

  -- 2b. polis-/certificaatnummer -> klant_certificaten (nummer + onderneming); gedeeld = voorstel
  IF v_ond IS NULL AND v_nr IS NOT NULL THEN
    SELECT array_agg(DISTINCT c.onderneming_id), bool_and(c.koppeling_status = 'bevestigd') INTO ids, v_bevestigd
      FROM public.klant_certificaten c
     WHERE upper(c.certificaatnummer) = v_nr AND c.koppeling_status <> 'afgewezen'
       AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = c.onderneming_id AND k.status IN ('actief','loopt_af'));
    IF coalesce(array_length(ids,1),0) = 1 AND v_bevestigd THEN
      v_status := 'zeker'; v_methode := 'certificaatnummer'; v_ond := ids[1];
    ELSIF coalesce(array_length(ids,1),0) >= 1 THEN
      v_status := 'voorstel'; v_ond := ids[1];
      v_methode := CASE WHEN array_length(ids,1) > 1 THEN 'certificaatnummer_gedeeld' ELSE 'certificaatnummer_voorstel' END;
      v_det := v_det || jsonb_build_object('certificaat_kandidaten', to_jsonb(ids));
    END IF;
  END IF;

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
END $function$;