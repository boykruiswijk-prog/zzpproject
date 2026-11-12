-- Spoed 12-11-2026: polis vindbaar via onderneming, contract en lead; nooit een tweede BAV-nummer voor dezelfde klant.
CREATE OR REPLACE FUNCTION public.onderneming_lead_ids(_ond uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id FROM leads l WHERE _ond IS NOT NULL AND l.gekoppeld_onderneming_id = _ond
  UNION SELECT k.bron_id FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id
         WHERE _ond IS NOT NULL AND k.bron_tabel = 'leads' AND po.onderneming_id = _ond
  UNION SELECT l.id FROM leads l JOIN ondernemingen o ON o.exact_relatie_code = l.exact_relatie_code
         WHERE _ond IS NOT NULL AND o.id = _ond AND coalesce(l.exact_relatie_code,'') <> ''
  UNION SELECT l.id FROM leads l JOIN ondernemingen o ON o.kvk = l.kvk_nummer
         WHERE _ond IS NOT NULL AND o.id = _ond AND coalesce(l.kvk_nummer,'') <> ''
$$;

-- Eenduidige onderneming bij een lead (alle routes samen precies één, samengevoegd naar de hoofdkaart); anders NULL.
CREATE OR REPLACE FUNCTION public.policy_onderneming_afleiden(_lead uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT l.gekoppeld_onderneming_id o FROM leads l WHERE l.id = _lead AND l.gekoppeld_onderneming_id IS NOT NULL
    UNION SELECT po.onderneming_id FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id WHERE k.bron_tabel = 'leads' AND k.bron_id = _lead
    UNION SELECT o.id FROM leads l JOIN ondernemingen o ON o.exact_relatie_code = l.exact_relatie_code WHERE l.id = _lead AND coalesce(l.exact_relatie_code,'') <> ''
    UNION SELECT o.id FROM leads l JOIN ondernemingen o ON o.kvk = l.kvk_nummer WHERE l.id = _lead AND coalesce(l.kvk_nummer,'') <> ''
  ), h AS (SELECT DISTINCT coalesce(o.samengevoegd_naar, o.id) id FROM r JOIN ondernemingen o ON o.id = r.o)
  SELECT CASE WHEN (SELECT count(*) FROM h) = 1 THEN (SELECT id FROM h) END
$$;

CREATE OR REPLACE FUNCTION public.policy_onderneming_bij_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.onderneming_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    NEW.onderneming_id := public.policy_onderneming_afleiden(NEW.lead_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aa_policy_onderneming_afleiden ON public.policies;
CREATE TRIGGER aa_policy_onderneming_afleiden BEFORE INSERT ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.policy_onderneming_bij_insert();

-- Bestaand geldig BAV-nummer van deze klant (onderneming, leads van de onderneming, zelfde KvK); NULL = nieuw nummer toegestaan.
CREATE OR REPLACE FUNCTION public.bestaand_geldig_bav_nummer(_ond uuid, _lead uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ond AS (SELECT coalesce(_ond, public.policy_onderneming_afleiden(_lead)) id),
  kvk AS (SELECT o.kvk FROM ondernemingen o, ond WHERE o.id = ond.id AND coalesce(o.kvk,'') <> ''),
  onds AS (SELECT id FROM ond WHERE id IS NOT NULL
           UNION SELECT o.id FROM ondernemingen o JOIN kvk ON o.kvk = kvk.kvk WHERE o.samengevoegd_naar IS NULL),
  lds AS (SELECT _lead id WHERE _lead IS NOT NULL UNION SELECT public.onderneming_lead_ids(onds.id) FROM onds)
  SELECT upper(p.certificate_number) FROM policies p
   WHERE p.status = 'geldig' AND upper(p.certificate_number) ~ '^ZPBAV[0-9]+$'
     AND (p.onderneming_id IN (SELECT id FROM onds) OR p.lead_id IN (SELECT id FROM lds))
   ORDER BY p.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.certificaatnummer_voorstel_intern(_onderneming_id uuid, _lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ond uuid := _onderneming_id; r record; g record; i record; v_n int; v_leads uuid[];
BEGIN
  IF v_ond IS NULL AND _lead_id IS NOT NULL THEN
    SELECT count(DISTINCT po.onderneming_id), min(po.onderneming_id::text)::uuid INTO v_n, v_ond
      FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id
     WHERE k.bron_tabel = 'leads' AND k.bron_id = _lead_id;
    IF v_n <> 1 THEN v_ond := NULL; END IF;
    IF v_ond IS NULL THEN v_ond := public.policy_onderneming_afleiden(_lead_id); END IF;
  END IF;
  -- Leads van deze klant: ook polissen zonder onderneming_id (alleen lead) tellen mee.
  v_leads := ARRAY(SELECT _lead_id WHERE _lead_id IS NOT NULL UNION SELECT public.onderneming_lead_ids(v_ond));

  FOR r IN
    SELECT * FROM (
      SELECT 1 prio, 'overgenomen' bron, upper(btrim(o.bav_nummer)) nummer, o.vastgelegd_op datum, o.vastgelegd_door door
        FROM onderneming_opvolging o
       WHERE coalesce(btrim(o.bav_nummer),'') <> '' AND NOT o.is_test
         AND ((v_ond IS NOT NULL AND o.naar_onderneming_id = v_ond) OR o.lead_id = ANY (v_leads))
      UNION ALL
      SELECT 2, 'bevestigd', upper(btrim(b.nummer)), b.bevestigd_op, b.bevestigd_door
        FROM bav_nummer_bevestigingen b WHERE v_ond IS NOT NULL AND b.onderneming_id = v_ond
      UNION ALL
      SELECT 3, 'klant_certificaat', upper(btrim(c.certificaatnummer)), coalesce(c.beoordeeld_op, c.aanvraagdatum::timestamptz), c.beoordeeld_door
        FROM klant_certificaten c WHERE v_ond IS NOT NULL AND c.onderneming_id = v_ond AND c.koppeling_status = 'bevestigd' AND NOT c.is_test
      UNION ALL
      SELECT 4, 'eerdere_policy', upper(btrim(pp.certificate_number)), pp.created_at, NULL::uuid
        FROM policies pp WHERE (v_ond IS NOT NULL AND pp.onderneming_id = v_ond) OR pp.lead_id = ANY (v_leads)
    ) x
    WHERE x.nummer ~ '^ZPBAV[0-9]+$'
    ORDER BY prio, datum DESC NULLS LAST
  LOOP
    g := NULL;
    SELECT id, onderneming_id, lead_id INTO g FROM policies WHERE upper(certificate_number) = r.nummer AND status = 'geldig' LIMIT 1;
    IF g.id IS NOT NULL AND NOT ((v_ond IS NOT NULL AND g.onderneming_id = v_ond) OR g.lead_id = ANY (v_leads)) THEN
      CONTINUE; -- geldig bij een andere klant
    END IF;
    IF EXISTS (SELECT 1 FROM policies q WHERE upper(q.certificate_number) = r.nummer AND q.status <> 'geldig'
               AND NOT ((v_ond IS NOT NULL AND q.onderneming_id IS NOT DISTINCT FROM v_ond) OR q.lead_id = ANY (v_leads)
                        OR (_lead_id IS NOT NULL AND q.lead_id IS NOT DISTINCT FROM _lead_id))) THEN
      CONTINUE;
    END IF;
    i := NULL;
    SELECT id INTO i FROM policies WHERE upper(certificate_number) = r.nummer AND status = 'ingetrokken'
      ORDER BY coalesce(ingetrokken_op, created_at) DESC LIMIT 1;
    RETURN jsonb_build_object('nummer', r.nummer,
      'bron', CASE WHEN g.id IS NULL AND i.id IS NOT NULL AND r.bron = 'eerdere_policy' THEN 'eerdere_policy_ingetrokken' ELSE r.bron END,
      'datum', r.datum, 'door_naam', (SELECT full_name FROM profiles WHERE id = r.door), 'onderneming_id', v_ond,
      'staat_al_op_policy', g.id IS NOT NULL,
      'policy_id', g.id,
      'policy_status', CASE WHEN g.id IS NOT NULL THEN 'geldig' WHEN i.id IS NOT NULL THEN 'ingetrokken' END,
      'vervangt_ingetrokken_policy_id', CASE WHEN g.id IS NULL THEN i.id END);
  END LOOP;
  RETURN jsonb_build_object('nummer', NULL, 'bron', 'geen', 'onderneming_id', v_ond,
    'bestaand_geldig', public.bestaand_geldig_bav_nummer(v_ond, _lead_id));
END $function$;

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n bigint; vrij bigint; v jsonb; b text;
BEGIN
  IF upper(coalesce(NEW.certificate_number,'')) = 'NIEUW' THEN
    -- Nooit een tweede BAV-nummer als de klant al een geldige polis heeft (via onderneming, lead of zelfde KvK).
    b := public.bestaand_geldig_bav_nummer(NEW.onderneming_id, NEW.lead_id);
    IF b IS NOT NULL THEN
      RAISE EXCEPTION 'Deze klant heeft al een geldig certificaat (%). Er wordt geen nieuw nummer uitgegeven; gebruik Aanpassen.', b
        USING ERRCODE = 'P0001';
    END IF;
    n := nextval('public.policy_cert_seq');
    vrij := public.eerste_vrije_certificaatnummer(n);
    IF vrij > n THEN PERFORM setval('public.policy_cert_seq', vrij); END IF;
    NEW.certificate_number := 'ZPBAV' || vrij::text;
    RETURN NEW;
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
    RAISE EXCEPTION 'Geen bekend BAV-nummer; bevestig eerst een nummer';
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.onderneming_lead_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.policy_onderneming_afleiden(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.policy_onderneming_bij_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bestaand_geldig_bav_nummer(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onderneming_lead_ids(uuid), public.policy_onderneming_afleiden(uuid), public.bestaand_geldig_bav_nummer(uuid, uuid) TO service_role;

-- Scenario's certificaatnummer (spoed 12-11-2026); draaien binnen test_scenario en worden daar teruggedraaid.
CREATE OR REPLACE FUNCTION public._ts_certificaat(p_naam text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a';
  ond_b constant uuid := '7e570000-0000-4000-8000-00000000000b';
  persoon constant uuid := '7e570000-0000-4000-8000-000000000001';
  c jsonb := '[]'; l uuid; p uuid; k uuid; v jsonb; res jsonb; f text;
BEGIN
  IF p_naam IN ('certificaat_polis_via_lead', 'certificaat_ingangsdatum') THEN
    INSERT INTO leads (voornaam, achternaam, email, bedrijfsnaam, kvk_nummer, is_test)
      VALUES ('Testpersoon', 'ZP Zaken', 'test+testpersoon@zpzaken.nl', 'Testpersoon ZP Zaken', '99000101', true) RETURNING id INTO l;
    INSERT INTO policies (certificate_number, certificate_holder, insured_name, start_date, profession, status, lead_id, is_test)
      VALUES ('ZPBAVTEST11', 'Testpersoon ZP Zaken', 'Testpersoon ZP Zaken', '2026-12-01', 'Testberoep', 'geldig', l, true) RETURNING id INTO p;
    c := c || public._ts_c('activatie zet onderneming_id via lead', ond_a::text, (SELECT onderneming_id::text FROM policies WHERE id = p));
    -- Oude situatie nabootsen: polis alleen aan de lead gekoppeld.
    UPDATE policies SET onderneming_id = NULL WHERE id = p;
  END IF;

  IF p_naam = 'certificaat_polis_via_lead' THEN
    v := public.certificaatnummer_voorstel(ond_a, NULL);
    c := c || public._ts_c('dialoog vindt bestaand nummer via onderneming', 'ZPBAVTEST11', v->>'nummer')
           || public._ts_c('nummer staat al op een geldige polis', 'true', v->>'staat_al_op_policy')
           || public._ts_c('nieuw nummer niet toegestaan', 'ZPBAVTEST11', public.bestaand_geldig_bav_nummer(ond_a, NULL));
    f := public._ts_fout(format($q$INSERT INTO policies (certificate_number, certificate_holder, insured_name, start_date, profession, status, onderneming_id, is_test)
           VALUES ('NIEUW','x','x','2026-12-01','x','geldig',%L,true)$q$, ond_a));
    c := c || public._ts_c('Ja, nieuw nummer uitgeven geweigerd', 'true', (f LIKE 'Deze klant heeft al een geldig certificaat (ZPBAVTEST11)%')::text);
  ELSIF p_naam = 'certificaat_ingangsdatum' THEN
    INSERT INTO persoon_bron_koppeling (persoon_id, bron_tabel, bron_id) VALUES (persoon, 'leads', l);
    k := public._ts_contract(ond_a, '2026-12-01');
    res := public.contract_wijzig_ingangsdatum(k, '2026-11-30', 'Scenario: certificaat met zelfde nummer');
    c := c || public._ts_c('polis zonder onderneming_id krijgt nieuwe datum', '2026-11-30', (SELECT start_date::text FROM policies WHERE id = p))
           || public._ts_c('nummer ongewijzigd', 'ZPBAVTEST11', (SELECT certificate_number FROM policies WHERE id = p))
           || public._ts_c('certificaatdialoog opent met hetzelfde nummer', 'ZPBAVTEST11', public.certificaatnummer_voorstel(ond_a, NULL)->>'nummer')
           || public._ts_c('aantal geldige polissen van deze klant', '1', (SELECT count(*)::text FROM policies WHERE status = 'geldig' AND (onderneming_id = ond_a OR lead_id = l)));
  ELSIF p_naam = 'certificaat_nieuwe_klant' THEN
    v := public.certificaatnummer_voorstel(ond_b, NULL);
    c := c || public._ts_c('echt nieuwe klant: geen bekend nummer', NULL, v->>'nummer')
           || public._ts_c('nieuw nummer toegestaan', NULL, public.bestaand_geldig_bav_nummer(ond_b, NULL));
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_certificaat(text) FROM PUBLIC, anon, authenticated;

-- test_scenario uitbreiden met de certificaatscenario's (tekstuele aanvulling op de bestaande definitie).
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.test_scenario(text)'::regprocedure);
  IF position('_ts_certificaat' IN d) = 0 THEN
    d := replace(d, $r$'planner_dryrun_testpersoon'] || vitest$r$,
                    $r$'planner_dryrun_testpersoon','certificaat_polis_via_lead','certificaat_ingangsdatum','certificaat_nieuwe_klant'] || vitest$r$);
    d := replace(d, $r$    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$, $r$    ELSIF p_naam IN ('certificaat_polis_via_lead','certificaat_ingangsdatum','certificaat_nieuwe_klant') THEN
      c := c || public._ts_certificaat(p_naam);
    ELSE
      RAISE EXCEPTION USING ERRCODE = 'P0T02'$r$);
    IF position('_ts_certificaat' IN d) = 0 OR position('certificaat_nieuwe_klant''] || vitest' IN d) = 0 THEN
      RAISE EXCEPTION 'test_scenario kon niet worden uitgebreid';
    END IF;
    EXECUTE d;
  END IF;
END $do$;
REVOKE ALL ON FUNCTION public.test_scenario(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._ts_tel()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t text; uit jsonb := '{}'; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['klant_contracten','policies','klant_service_aanvragen','crm_notities','lead_notes','crm_taken','sensitive_audit_log',
    'ondernemingen','onderneming_opvolging','onderneming_koppelingen','persoon_onderneming','factuur_planning','factuur_credit_planning',
    'email_send_log','lead_notification_log','wijzigingsmeldingen','activiteiten_log','leads','persoon_bron_koppeling','polis_audit_log','policy_versies'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    uit := uit || jsonb_build_object(t, n);
  END LOOP;
  RETURN uit;
END $$;