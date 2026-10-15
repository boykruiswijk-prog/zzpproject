-- Besluiten Boy 15-10-2026: D9 mislukte incasso, D8 prolongatie jaarpolis, klantmail-schakelaars.
-- Alle nieuwe klantmails staan uit tot Boy de tekst heeft goedgekeurd. Niets naar Exact.

CREATE TABLE public.klantmail_instellingen (
  sleutel text PRIMARY KEY,
  naam text NOT NULL,
  moment text NOT NULL,
  actief boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'wacht_op_akkoord_boy',
  onderwerp text,
  tekst text,
  placeholders text[] NOT NULL DEFAULT '{}',
  bijgewerkt_door uuid,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.klantmail_instellingen TO authenticated;
GRANT ALL ON public.klantmail_instellingen TO service_role;
ALTER TABLE public.klantmail_instellingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest klantmail_instellingen" ON public.klantmail_instellingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE TABLE public.klantmail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sleutel text NOT NULL,
  status text NOT NULL,
  ontvanger text,
  onderneming_id uuid,
  lead_id uuid,
  incasso_id uuid,
  klant_contract_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX klantmail_log_sleutel_idx ON public.klantmail_log (sleutel, created_at);
GRANT SELECT ON public.klantmail_log TO authenticated;
GRANT ALL ON public.klantmail_log TO service_role;
ALTER TABLE public.klantmail_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin leest klantmail_log" ON public.klantmail_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.incasso_mislukt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  klant_contract_id uuid,
  factuur_planning_id uuid,
  lead_id uuid,
  factuurnummer text NOT NULL,
  bedrag numeric,
  mislukt_op date NOT NULL,
  bron text NOT NULL DEFAULT 'handmatig' CHECK (bron IN ('handmatig','exact_detectie')),
  reden text,
  gemeld_door uuid,
  betaald_op date,
  dekking_opgeschort_sinds date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','betaald','royement_voorgesteld','geroyeerd','vervallen')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX incasso_mislukt_uniek_open ON public.incasso_mislukt (onderneming_id, factuurnummer) WHERE status = 'open';
GRANT SELECT ON public.incasso_mislukt TO authenticated;
GRANT ALL ON public.incasso_mislukt TO service_role;
ALTER TABLE public.incasso_mislukt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest incasso_mislukt" ON public.incasso_mislukt FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE TABLE public.incasso_cyclus_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incasso_id uuid NOT NULL REFERENCES public.incasso_mislukt(id),
  stap text NOT NULL CHECK (stap IN ('herinnering_1','herinnering_2_aanmaning','herinnering_3_opschorting','royement_voorstel')),
  uitgevoerd_op date NOT NULL,
  mail_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incasso_id, stap)
);
GRANT SELECT ON public.incasso_cyclus_log TO authenticated;
GRANT ALL ON public.incasso_cyclus_log TO service_role;
ALTER TABLE public.incasso_cyclus_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest incasso_cyclus_log" ON public.incasso_cyclus_log FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE TABLE public.prolongatie_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klant_contract_id uuid NOT NULL,
  onderneming_id uuid,
  verlengdatum date NOT NULL,
  ontvanger text,
  mail_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (klant_contract_id, verlengdatum)
);
GRANT SELECT ON public.prolongatie_log TO authenticated;
GRANT ALL ON public.prolongatie_log TO service_role;
ALTER TABLE public.prolongatie_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest prolongatie_log" ON public.prolongatie_log FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

ALTER TABLE public.crm_taken DROP CONSTRAINT crm_taken_soort_check;
ALTER TABLE public.crm_taken ADD CONSTRAINT crm_taken_soort_check CHECK (soort = ANY (ARRAY['exact_aanpassen','nieuwe_aanvraag_nodig','afas_factuur_opvragen','incasso_mislukt_bellen','royement_bevestigen']));

-- Concepten (Concept, wacht op akkoord Boy)
INSERT INTO public.klantmail_instellingen (sleutel, naam, moment, onderwerp, tekst, placeholders) VALUES
('incasso_herinnering_1', 'Incasso niet gelukt (herinnering 1)', 'Dag 0 na mislukte incasso',
 'Je betaling voor factuur {factuurnummer} is niet gelukt',
 E'Beste {voornaam},\n\nDe automatische incasso van {bedrag} voor factuur {factuurnummer} van {factuurdatum} ({bedrijfsnaam}, polis {polisnummer}) is niet gelukt.\n\nWil je het bedrag binnen 14 dagen, uiterlijk {betaal_voor}, overmaken? Je betaalverplichting blijft bestaan.\n\nHeb je vragen of is er iets misgegaan? Bel ons gerust op 020 - 457 3077.\n\nMet vriendelijke groet,\nZP Zaken',
 ARRAY['voornaam','bedrijfsnaam','bedrag','polisnummer','factuurnummer','factuurdatum','betaal_voor']),
('incasso_herinnering_2_aanmaning', 'Aanmaning (herinnering 2)', 'Dag 14 na mislukte incasso',
 'Herinnering: factuur {factuurnummer} is nog niet betaald',
 E'Beste {voornaam},\n\nWe hebben de betaling van {bedrag} voor factuur {factuurnummer} van {factuurdatum} ({bedrijfsnaam}, polis {polisnummer}) nog niet ontvangen.\n\nWil je het bedrag binnen 14 dagen, uiterlijk {betaal_voor}, betalen? Ontvangen we de betaling niet op tijd, dan wordt de dekking opgeschort volgens de polisvoorwaarden en artikel 7:934 BW. Tijdens de opschorting is er geen dekking voor schades die in die periode ontstaan.\n\nVragen? Bel ons op 020 - 457 3077.\n\nMet vriendelijke groet,\nZP Zaken',
 ARRAY['voornaam','bedrijfsnaam','bedrag','polisnummer','factuurnummer','factuurdatum','betaal_voor']),
('incasso_herinnering_3_opschorting', 'Dekking opgeschort (herinnering 3)', 'Dag 28 na mislukte incasso',
 'Je dekking is opgeschort per {opschort_datum}',
 E'Beste {voornaam},\n\nOndanks onze herinneringen hebben we de betaling van {bedrag} voor factuur {factuurnummer} ({bedrijfsnaam}, polis {polisnummer}) niet ontvangen. Daarom is de dekking per {opschort_datum} opgeschort. Je betaalverplichting blijft bestaan.\n\nNa ontvangst van de betaling wordt de dekking hervat vanaf de dag na ontvangst. Blijft betaling uit, dan volgt beeindiging van de verzekering.\n\nVragen? Bel ons op 020 - 457 3077.\n\nMet vriendelijke groet,\nZP Zaken',
 ARRAY['voornaam','bedrijfsnaam','bedrag','polisnummer','factuurnummer','opschort_datum']),
('prolongatie_jaarpolis', 'Prolongatie jaarpolis', '14 dagen voor de verlengdatum',
 'Je verzekering wordt per {verlengdatum} verlengd',
 E'Beste {voornaam},\n\nJe verzekering voor {bedrijfsnaam} (polis {polisnummer}) wordt per {verlengdatum} stilzwijgend verlengd. Je ontvangt hiervoor een factuur van {bedrag}; het bedrag wordt rond die datum automatisch geincasseerd.\n\nHeb je vragen? Bel ons op 020 - 457 3077.\n\nMet vriendelijke groet,\nZP Zaken',
 ARRAY['voornaam','bedrijfsnaam','polisnummer','verlengdatum','bedrag']);

-- Schakelaar: alleen admin, met expliciet akkoord Boy als de status nog wacht.
CREATE OR REPLACE FUNCTION public.zet_klantmail_actief(_sleutel text, _actief boolean, _akkoord_boy boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE k public.klantmail_instellingen;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'alleen admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO k FROM public.klantmail_instellingen WHERE sleutel = _sleutel FOR UPDATE;
  IF k.sleutel IS NULL THEN RAISE EXCEPTION 'onbekende klantmail'; END IF;
  IF _actief AND k.status = 'wacht_op_akkoord_boy' AND NOT coalesce(_akkoord_boy,false) THEN
    RAISE EXCEPTION 'Bevestig eerst dat Boy de tekst heeft goedgekeurd';
  END IF;
  UPDATE public.klantmail_instellingen SET actief = _actief,
    status = CASE WHEN _actief AND k.status = 'wacht_op_akkoord_boy' THEN 'goedgekeurd_boy' ELSE status END,
    bijgewerkt_door = auth.uid(), bijgewerkt_op = now() WHERE sleutel = _sleutel;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klantmail_instellingen', NULL, 'klantmail_schakelaar', _sleutel, k.actief::text, _actief::text, auth.uid(),
          jsonb_build_object('akkoord_boy', coalesce(_akkoord_boy,false), 'status_voor', k.status));
  RETURN jsonb_build_object('sleutel', _sleutel, 'actief', _actief);
END $f$;
REVOKE ALL ON FUNCTION public.zet_klantmail_actief(text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zet_klantmail_actief(text,boolean,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.klantmail_tekst_opslaan(_sleutel text, _onderwerp text, _tekst text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE k public.klantmail_instellingen;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'alleen admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO k FROM public.klantmail_instellingen WHERE sleutel = _sleutel FOR UPDATE;
  IF k.sleutel IS NULL THEN RAISE EXCEPTION 'onbekende klantmail'; END IF;
  -- Gewijzigde tekst vraagt opnieuw akkoord Boy en zet de mail uit.
  UPDATE public.klantmail_instellingen SET onderwerp = _onderwerp, tekst = _tekst, actief = false, status = 'wacht_op_akkoord_boy',
    bijgewerkt_door = auth.uid(), bijgewerkt_op = now() WHERE sleutel = _sleutel;
  INSERT INTO public.sensitive_audit_log (target_table, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klantmail_instellingen', 'klantmail_tekst_gewijzigd', _sleutel, k.onderwerp, _onderwerp, auth.uid(), jsonb_build_object('oude_tekst', k.tekst, 'nieuwe_tekst', _tekst));
  RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.klantmail_tekst_opslaan(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klantmail_tekst_opslaan(text,text,text) TO authenticated, service_role;

-- D9: mislukte incasso melden, direct een beltaak (nooit dubbel).
CREATE OR REPLACE FUNCTION public.meld_incasso_mislukt(_onderneming_id uuid, _factuurnummer text, _bedrag numeric, _mislukt_op date,
  _reden text DEFAULT NULL, _bron text DEFAULT 'handmatig', _klant_contract_id uuid DEFAULT NULL, _factuur_planning_id uuid DEFAULT NULL, _lead_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE o public.ondernemingen; v_id uuid; v_taak uuid; v_nr text := nullif(trim(_factuurnummer),'');
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  IF v_nr IS NULL THEN RAISE EXCEPTION 'factuurnummer verplicht'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  SELECT id INTO v_id FROM public.incasso_mislukt WHERE onderneming_id = o.id AND factuurnummer = v_nr AND status = 'open';
  IF v_id IS NULL THEN
    INSERT INTO public.incasso_mislukt (onderneming_id, klant_contract_id, factuur_planning_id, lead_id, factuurnummer, bedrag, mislukt_op, bron, reden, gemeld_door, is_test)
    VALUES (o.id, _klant_contract_id, _factuur_planning_id, _lead_id, v_nr, _bedrag, coalesce(_mislukt_op, (now() AT TIME ZONE 'Europe/Amsterdam')::date),
            coalesce(_bron,'handmatig'), nullif(trim(_reden),''), auth.uid(), coalesce(o.is_test,false))
    RETURNING id INTO v_id;
  END IF;
  SELECT id INTO v_taak FROM public.crm_taken WHERE soort = 'incasso_mislukt_bellen' AND status = 'open' AND onderneming_id = o.id AND details->>'factuurnummer' = v_nr;
  IF v_taak IS NULL THEN
    INSERT INTO public.crm_taken (soort, onderneming_id, omschrijving, details, aangemaakt_door, is_test)
    VALUES ('incasso_mislukt_bellen', o.id, 'Klant bellen: incasso mislukt',
            jsonb_build_object('klant', o.naam, 'factuurnummer', v_nr, 'bedrag', _bedrag, 'datum', coalesce(_mislukt_op, (now() AT TIME ZONE 'Europe/Amsterdam')::date), 'incasso_id', v_id),
            auth.uid(), coalesce(o.is_test,false))
    RETURNING id INTO v_taak;
  END IF;
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door)
  VALUES ('incasso_mislukt', 'Incasso mislukt gemeld: ' || coalesce(o.naam,'') || ', factuur ' || v_nr, auth.uid());
  RETURN jsonb_build_object('incasso_id', v_id, 'taak_id', v_taak);
END $f$;
REVOKE ALL ON FUNCTION public.meld_incasso_mislukt(uuid,text,numeric,date,text,text,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meld_incasso_mislukt(uuid,text,numeric,date,text,text,uuid,uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.incasso_betaald(_id uuid, _datum date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE i public.incasso_mislukt;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.incasso_mislukt WHERE id = _id FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'niet gevonden'; END IF;
  IF i.status NOT IN ('open','royement_voorgesteld') THEN RAISE EXCEPTION 'status is al %', i.status; END IF;
  -- Cyclus stopt en opschorting vervalt (dekking_opgeschort leest alleen open/royement_voorgesteld).
  UPDATE public.incasso_mislukt SET status = 'betaald', betaald_op = coalesce(_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date) WHERE id = _id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, details)
  VALUES ('incasso_mislukt', _id, 'incasso_betaald', auth.uid(), jsonb_build_object('betaald_op', coalesce(_datum, (now() AT TIME ZONE 'Europe/Amsterdam')::date), 'opgeschort_sinds', i.dekking_opgeschort_sinds));
  RETURN jsonb_build_object('id', _id, 'status', 'betaald');
END $f$;
REVOKE ALL ON FUNCTION public.incasso_betaald(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incasso_betaald(uuid,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bevestig_royement(_id uuid, _toelichting text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE i public.incasso_mislukt;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'alleen supervisor of admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.incasso_mislukt WHERE id = _id FOR UPDATE;
  IF i.status <> 'royement_voorgesteld' THEN RAISE EXCEPTION 'royement is niet voorgesteld'; END IF;
  -- Alleen status en logregel; geen contract beeindigen, niets in Exact.
  UPDATE public.incasso_mislukt SET status = 'geroyeerd' WHERE id = _id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, details)
  VALUES ('incasso_mislukt', _id, 'royement_bevestigd', auth.uid(), jsonb_build_object('toelichting', _toelichting, 'onderneming_id', i.onderneming_id));
  RETURN jsonb_build_object('id', _id, 'status', 'geroyeerd');
END $f$;
REVOKE ALL ON FUNCTION public.bevestig_royement(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bevestig_royement(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dekking_opgeschort(_onderneming_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT min(dekking_opgeschort_sinds) FROM public.incasso_mislukt
   WHERE onderneming_id = _onderneming_id AND status IN ('open','royement_voorgesteld') AND dekking_opgeschort_sinds IS NOT NULL
$f$;
REVOKE ALL ON FUNCTION public.dekking_opgeschort(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dekking_opgeschort(uuid) TO authenticated, service_role;

-- Pure stapregel, gespiegeld in _shared/incassoCyclus.ts welkeStap().
CREATE OR REPLACE FUNCTION public.incasso_welke_stap(_dagen int)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE WHEN _dagen >= 42 THEN 'royement_voorstel' WHEN _dagen >= 28 THEN 'herinnering_3_opschorting'
              WHEN _dagen >= 14 THEN 'herinnering_2_aanmaning' WHEN _dagen >= 0 THEN 'herinnering_1' END
$f$;

-- Engine: idempotent, elke stap een keer per incasso. Alleen open gevallen; betaald stopt de cyclus.
CREATE OR REPLACE FUNCTION public.incasso_cyclus_stap(_vandaag date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE i record; v_stap text; v_log uuid; v_uit jsonb := '[]'::jsonb; v_ellen uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'alleen service_role' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_ellen FROM public.profiles WHERE full_name ILIKE 'Ellen Baars' LIMIT 1;
  FOR i IN SELECT m.*, o.naam onaam FROM public.incasso_mislukt m JOIN public.ondernemingen o ON o.id = m.onderneming_id WHERE m.status = 'open' LOOP
    v_stap := public.incasso_welke_stap(_vandaag - i.mislukt_op);
    CONTINUE WHEN v_stap IS NULL;
    INSERT INTO public.incasso_cyclus_log (incasso_id, stap, uitgevoerd_op) VALUES (i.id, v_stap, _vandaag)
      ON CONFLICT (incasso_id, stap) DO NOTHING RETURNING id INTO v_log;
    CONTINUE WHEN v_log IS NULL;
    IF v_stap = 'herinnering_3_opschorting' THEN
      UPDATE public.incasso_mislukt SET dekking_opgeschort_sinds = _vandaag WHERE id = i.id AND dekking_opgeschort_sinds IS NULL;
    ELSIF v_stap = 'royement_voorstel' THEN
      -- Alleen een voorstel: nooit automatisch royeren of een contract beeindigen.
      UPDATE public.incasso_mislukt SET status = 'royement_voorgesteld' WHERE id = i.id;
      IF NOT EXISTS (SELECT 1 FROM public.crm_taken WHERE soort = 'royement_bevestigen' AND status = 'open' AND details->>'incasso_id' = i.id::text) THEN
        INSERT INTO public.crm_taken (soort, onderneming_id, omschrijving, details, is_test)
        VALUES ('royement_bevestigen', i.onderneming_id, 'Royement bevestigen',
          jsonb_build_object('klant', i.onaam, 'factuurnummer', i.factuurnummer, 'bedrag', i.bedrag, 'incasso_id', i.id, 'toegewezen_aan', v_ellen), i.is_test);
      END IF;
      UPDATE public.incasso_cyclus_log SET mail_status = 'geen_mail' WHERE id = v_log;
    END IF;
    v_uit := v_uit || jsonb_build_object('log_id', v_log, 'incasso_id', i.id, 'stap', v_stap, 'onderneming_id', i.onderneming_id, 'lead_id', i.lead_id,
      'factuurnummer', i.factuurnummer, 'bedrag', i.bedrag, 'mislukt_op', i.mislukt_op, 'is_test', i.is_test,
      'opschort_datum', CASE WHEN v_stap = 'herinnering_3_opschorting' THEN _vandaag END);
  END LOOP;
  RETURN v_uit;
END $f$;
REVOKE ALL ON FUNCTION public.incasso_cyclus_stap(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incasso_cyclus_stap(date) TO service_role;

-- D8: jaarcontracten die over _dagen dagen verlengen (stilzwijgend), niet opgezegd, geen test.
CREATE OR REPLACE FUNCTION public.prolongatie_kandidaten(_van date, _tot date)
RETURNS TABLE(klant_contract_id uuid, onderneming_id uuid, klantnaam text, product text, itemcode text, bedrag numeric, verlengdatum date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT k.id, k.onderneming_id, o.naam, k.product, k.itemcode, round(k.bedrag_per_periode * k.aantal, 2), k.volgende_factuurdatum
    FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id = k.onderneming_id
   WHERE k.cyclus = 'jaar' AND k.status IN ('actief','einddatum_controle') AND NOT k.is_test AND NOT coalesce(o.is_test,false)
     AND k.volgende_factuurdatum BETWEEN _van AND _tot AND public.contract_opzegging(k.id) IS NULL
   ORDER BY k.volgende_factuurdatum, o.naam
$f$;
REVOKE ALL ON FUNCTION public.prolongatie_kandidaten(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prolongatie_kandidaten(date,date) TO authenticated, service_role;

-- Vandaag te doen: blokken incasso en royement (bestaande blokken ongewijzigd).
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  IF position($a$  r := r || jsonb_build_object('klant_vlaggen', c);$a$ IN d) = 0 THEN RAISE EXCEPTION 'klant_vlaggen-blok niet gevonden'; END IF;
  d := replace(d, $a$  r := r || jsonb_build_object('klant_vlaggen', c);$a$, $a$  r := r || jsonb_build_object('klant_vlaggen', c);

  -- D9: klant bellen bij mislukte incasso
  WITH b AS (SELECT * FROM crm_taken t WHERE t.status = 'open' AND t.soort = 'incasso_mislukt_bellen' AND (_toon_test OR NOT t.is_test))
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'onderneming_id', onderneming_id, 'naam', details->>'klant', 'factuurnummer', details->>'factuurnummer',
      'bedrag', details->'bedrag', 'sinds', aangemaakt_op) ORDER BY aangemaakt_op) FROM (SELECT * FROM b ORDER BY aangemaakt_op LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('incasso', c);

  -- D9: royement bevestigen (alleen voorstel, nooit automatisch)
  WITH b AS (SELECT * FROM crm_taken t WHERE t.status = 'open' AND t.soort = 'royement_bevestigen' AND (_toon_test OR NOT t.is_test))
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'onderneming_id', onderneming_id, 'incasso_id', details->>'incasso_id', 'naam', details->>'klant',
      'factuurnummer', details->>'factuurnummer', 'bedrag', details->'bedrag', 'sinds', aangemaakt_op) ORDER BY aangemaakt_op) FROM (SELECT * FROM b ORDER BY aangemaakt_op LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('royement', c);$a$);
  d := replace(d, $a$'vlaggen','klant_vlaggen']$a$, $a$'vlaggen','klant_vlaggen','incasso','royement']$a$);
  IF position($a$'incasso','royement']$a$ IN d) = 0 THEN RAISE EXCEPTION 'totaal niet aangepast'; END IF;
  EXECUTE d;
END $do$;