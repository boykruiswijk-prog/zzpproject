-- Besluit Boy 15-10-2026 12:40: klantmailteksten goedgekeurd, vijf klantmails aan. Niets naar Exact.
ALTER TABLE public.klantmail_instellingen ADD COLUMN IF NOT EXISTS goedgekeurd_op date;
ALTER TABLE public.incasso_mislukt ADD COLUMN IF NOT EXISTS geroyeerd_op date;

-- Prolongatie: een mail per klant per verlengdatum.
CREATE UNIQUE INDEX IF NOT EXISTS prolongatie_log_klant_verlengdatum ON public.prolongatie_log (onderneming_id, verlengdatum);

-- Royementsbevestiging: maximaal een mail per incasso.
CREATE TABLE public.royement_mail_claim (
  incasso_id uuid PRIMARY KEY REFERENCES public.incasso_mislukt(id),
  geclaimd_door uuid,
  mail_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.royement_mail_claim TO authenticated;
GRANT ALL ON public.royement_mail_claim TO service_role;
ALTER TABLE public.royement_mail_claim ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest royement_mail_claim" ON public.royement_mail_claim FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

-- Goedgekeurde teksten.
UPDATE public.klantmail_instellingen SET
  onderwerp = 'Je betaling voor je verzekering is niet gelukt',
  tekst = E'Beste {voornaam},\n\nWe hebben je premie van {bedrag} voor polis {polisnummer} op {incasso_datum} geprobeerd te incasseren, maar dat is helaas niet gelukt. Dat kan gebeuren, bijvoorbeeld door een tijdelijk te laag saldo of een gewijzigd rekeningnummer.\n\nJe verzekering loopt gewoon door. Wil je het bedrag uiterlijk {uiterste_datum} overmaken naar {iban} onder vermelding van {factuurnummer}? Liever een nieuwe incasso? Laat het ons weten, dan regelen we dat. We bellen je ook even om mee te denken.\n\nVragen? Bel 020 - 457 3077.\n\nHartelijke groet,\nTeam ZP Zaken',
  placeholders = ARRAY['voornaam','bedrag','polisnummer','incasso_datum','uiterste_datum','iban','factuurnummer']
 WHERE sleutel = 'incasso_herinnering_1';
UPDATE public.klantmail_instellingen SET
  onderwerp = 'Herinnering: je premie staat nog open',
  tekst = E'Beste {voornaam},\n\nOp {incasso_datum} konden we je premie van {bedrag} voor polis {polisnummer} niet incasseren en we hebben je betaling nog niet ontvangen. Je betaalverplichting blijft bestaan.\n\nWe verzoeken je het bedrag uiterlijk {uiterste_datum} te betalen. Is het dan nog niet binnen, dan wordt je dekking vanaf de dag erna opgeschort. Voor schade die ontstaat tijdens de opschorting ben je dan niet verzekerd en zulke claims kunnen niet in behandeling worden genomen.\n\nIs er iets aan de hand? Bel ons op 020 - 457 3077, dan zoeken we samen naar een oplossing.\n\nHartelijke groet,\nTeam ZP Zaken',
  placeholders = ARRAY['voornaam','incasso_datum','bedrag','polisnummer','uiterste_datum']
 WHERE sleutel = 'incasso_herinnering_2_aanmaning';
UPDATE public.klantmail_instellingen SET
  onderwerp = 'Je dekking is opgeschort',
  tekst = E'Beste {voornaam},\n\nOndanks onze eerdere berichten hebben we je premie van {bedrag} nog niet ontvangen. Daarom is je dekking sinds {opschort_datum} opgeschort. Schade die vanaf die datum ontstaat, is niet verzekerd. Je betaalverplichting blijft bestaan.\n\nBetaal je het openstaande bedrag uiterlijk {uiterste_datum}, dan gaat je dekking weer in vanaf de dag na ontvangst. Na die datum beëindigen we je verzekering (royement) en blijft het openstaande bedrag verschuldigd.\n\nWe helpen je graag: 020 - 457 3077.\n\nHartelijke groet,\nTeam ZP Zaken',
  placeholders = ARRAY['voornaam','bedrag','opschort_datum','uiterste_datum']
 WHERE sleutel = 'incasso_herinnering_3_opschorting';
UPDATE public.klantmail_instellingen SET
  onderwerp = 'Je verzekering wordt op {verlengdatum} verlengd',
  tekst = E'Beste {voornaam},\n\nOp {verlengdatum} wordt je verzekering {product}, polis {polisnummer}, automatisch met een jaar verlengd. Je hoeft daar niets voor te doen.\n\nDe factuur van {bedrag}, inclusief kosten en assurantiebelasting, staat klaar en wordt rond {verlengdatum} van je rekening afgeschreven.\n\nBedankt voor je vertrouwen in ZP Zaken. Vragen? Bel 020 - 457 3077.\n\nHartelijke groet,\nTeam ZP Zaken',
  placeholders = ARRAY['voornaam','verlengdatum','product','polisnummer','bedrag']
 WHERE sleutel = 'prolongatie_jaarpolis';
INSERT INTO public.klantmail_instellingen (sleutel, naam, moment, onderwerp, tekst, placeholders) VALUES
('royement_bevestiging', 'Royementsbevestiging', 'Na de knop Royement bevestigen (Ellen)',
 'Je verzekering is beëindigd',
 E'Beste {voornaam},\n\nOmdat de premie ook na onze herinneringen niet is betaald, is je verzekering bij ZP Zaken per {royement_datum} beëindigd. Vanaf die datum ben je niet meer verzekerd. Het openstaande bedrag van {bedrag} blijft verschuldigd.\n\nWil je opnieuw verzekerd worden? Neem dan contact met ons op via 020 - 457 3077.\n\nHartelijke groet,\nTeam ZP Zaken',
 ARRAY['voornaam','royement_datum','bedrag'])
ON CONFLICT (sleutel) DO NOTHING;

-- Akkoord Boy 15-10-2026: alle vijf aan, met audit.
INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
SELECT 'klantmail_instellingen', NULL, 'klantmail_schakelaar', k.sleutel, k.actief::text, 'true', NULL,
       jsonb_build_object('akkoord_boy', true, 'toelichting', 'Boy heeft de tekst goedgekeurd 15-10-2026', 'bron', 'hubchat', 'status_voor', k.status)
  FROM public.klantmail_instellingen k
 WHERE k.sleutel IN ('incasso_herinnering_1','incasso_herinnering_2_aanmaning','incasso_herinnering_3_opschorting','prolongatie_jaarpolis','royement_bevestiging');
UPDATE public.klantmail_instellingen SET actief = true, status = 'goedgekeurd_boy', goedgekeurd_op = DATE '2026-10-15', bijgewerkt_op = now()
 WHERE sleutel IN ('incasso_herinnering_1','incasso_herinnering_2_aanmaning','incasso_herinnering_3_opschorting','prolongatie_jaarpolis','royement_bevestiging');

-- Gewijzigde tekst zet de mail uit, vraagt opnieuw akkoord en wist de goedkeuringsdatum.
CREATE OR REPLACE FUNCTION public.klantmail_tekst_opslaan(_sleutel text, _onderwerp text, _tekst text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE k public.klantmail_instellingen;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'alleen admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO k FROM public.klantmail_instellingen WHERE sleutel = _sleutel FOR UPDATE;
  IF k.sleutel IS NULL THEN RAISE EXCEPTION 'onbekende klantmail'; END IF;
  UPDATE public.klantmail_instellingen SET onderwerp = _onderwerp, tekst = _tekst, actief = false, status = 'wacht_op_akkoord_boy',
    goedgekeurd_op = NULL, bijgewerkt_door = auth.uid(), bijgewerkt_op = now() WHERE sleutel = _sleutel;
  INSERT INTO public.sensitive_audit_log (target_table, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klantmail_instellingen', 'klantmail_tekst_gewijzigd', _sleutel, k.onderwerp, _onderwerp, auth.uid(), jsonb_build_object('oude_tekst', k.tekst, 'nieuwe_tekst', _tekst));
  RETURN true;
END $f$;

-- Schakelaar: bij akkoord ook de goedkeuringsdatum zetten.
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
    goedgekeurd_op = CASE WHEN _actief AND k.status = 'wacht_op_akkoord_boy' THEN (now() AT TIME ZONE 'Europe/Amsterdam')::date ELSE goedgekeurd_op END,
    bijgewerkt_door = auth.uid(), bijgewerkt_op = now() WHERE sleutel = _sleutel;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, details)
  VALUES ('klantmail_instellingen', NULL, 'klantmail_schakelaar', _sleutel, k.actief::text, _actief::text, auth.uid(),
          jsonb_build_object('akkoord_boy', coalesce(_akkoord_boy,false), 'status_voor', k.status));
  RETURN jsonb_build_object('sleutel', _sleutel, 'actief', _actief);
END $f$;

-- Royement: alleen status en logregel, nu met datum van de bevestiging.
CREATE OR REPLACE FUNCTION public.bevestig_royement(_id uuid, _toelichting text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE i public.incasso_mislukt; v_datum date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'alleen supervisor of admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO i FROM public.incasso_mislukt WHERE id = _id FOR UPDATE;
  IF i.status <> 'royement_voorgesteld' THEN RAISE EXCEPTION 'royement is niet voorgesteld'; END IF;
  -- Alleen status en logregel; geen contract beeindigen, niets in Exact.
  UPDATE public.incasso_mislukt SET status = 'geroyeerd', geroyeerd_op = v_datum WHERE id = _id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, uitgevoerd_door, details)
  VALUES ('incasso_mislukt', _id, 'royement_bevestigd', auth.uid(), jsonb_build_object('toelichting', _toelichting, 'onderneming_id', i.onderneming_id, 'geroyeerd_op', v_datum));
  RETURN jsonb_build_object('id', _id, 'status', 'geroyeerd', 'geroyeerd_op', v_datum);
END $f$;
REVOKE ALL ON FUNCTION public.bevestig_royement(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bevestig_royement(uuid,text) TO authenticated, service_role;

-- D8: prolongatiemails per klant en verlengdatum. Alleen bav_avb-jaarcontracten geven een mail;
-- bedrag = som bav_avb + cyber_clear op die verlengdatum, nettoprijs zoals de factuurplanner (A13-korting).
CREATE OR REPLACE FUNCTION public.prolongatie_mails(_van date, _tot date)
RETURNS TABLE(onderneming_id uuid, klantnaam text, verlengdatum date, klant_contract_id uuid, product text, bedrag numeric, mail boolean, producten text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH k AS (
    SELECT c.id, c.onderneming_id, o.naam, c.product, c.volgende_factuurdatum vd,
           round(public.korting_netto(public.contract_bedrag_voor_periode(c.tarief_type, c.starter_tot, c.bedrag_per_periode, c.bedrag_na_starter, c.volgende_factuurdatum),
                 public.korting_voor_periode(c.korting_pct, c.korting_vanaf, c.korting_tot, c.volgende_factuurdatum)) * c.aantal, 2) netto
      FROM public.klant_contracten c JOIN public.ondernemingen o ON o.id = c.onderneming_id
     WHERE c.cyclus = 'jaar' AND c.status IN ('actief','einddatum_controle') AND NOT c.is_test AND NOT coalesce(o.is_test,false)
       AND c.volgende_factuurdatum BETWEEN _van AND _tot AND public.contract_opzegging(c.id) IS NULL
  )
  SELECT k.onderneming_id, min(k.naam), k.vd,
         (array_agg(k.id ORDER BY k.id) FILTER (WHERE k.product = 'bav_avb'))[1],
         CASE WHEN bool_or(k.product = 'cyber_clear') THEN 'BAV + AVB en Cyber' ELSE 'BAV + AVB' END,
         coalesce(sum(k.netto) FILTER (WHERE k.product IN ('bav_avb','cyber_clear')), 0),
         bool_or(k.product = 'bav_avb'),
         array_agg(DISTINCT k.product)
    FROM k GROUP BY k.onderneming_id, k.vd
   ORDER BY k.vd, min(k.naam);
END $f$;
REVOKE ALL ON FUNCTION public.prolongatie_mails(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prolongatie_mails(date,date) TO authenticated, service_role;

-- Verwachte klantmails in een periode (team-only). Incasso: stap van dag 0/14/28 die in de periode valt en nog niet gelogd is
-- (een achterstallige stap telt op _van, zoals de engine hem inhaalt). Prolongatie: mail 14 dagen voor de verlengdatum. Royement: handmatig.
CREATE OR REPLACE FUNCTION public.klantmail_verwachting(_van date, _tot date)
RETURNS TABLE(sleutel text, aantal integer, toelichting text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH s(stap, dag) AS (VALUES ('herinnering_1',0),('herinnering_2_aanmaning',14),('herinnering_3_opschorting',28)),
  i AS (
    SELECT s.stap, m.id FROM public.incasso_mislukt m CROSS JOIN s
     WHERE m.status = 'open' AND NOT m.is_test
       AND greatest(m.mislukt_op + s.dag, _van) <= _tot
       AND public.incasso_welke_stap(greatest(m.mislukt_op + s.dag, _van) - m.mislukt_op) = s.stap
       AND NOT EXISTS (SELECT 1 FROM public.incasso_cyclus_log l WHERE l.incasso_id = m.id AND l.stap = s.stap)
  ),
  p AS (
    SELECT pm.* FROM public.prolongatie_mails(_van + 14, _tot + 14) pm
     WHERE NOT EXISTS (SELECT 1 FROM public.prolongatie_log l WHERE l.onderneming_id = pm.onderneming_id AND l.verlengdatum = pm.verlengdatum)
  )
  SELECT 'incasso_herinnering_1'::text, (SELECT count(*)::int FROM i WHERE i.stap = 'herinnering_1'), 'Open mislukte incasso''s, dag 0'::text
  UNION ALL SELECT 'incasso_herinnering_2_aanmaning', (SELECT count(*)::int FROM i WHERE i.stap = 'herinnering_2_aanmaning'), 'Open mislukte incasso''s, dag 14'
  UNION ALL SELECT 'incasso_herinnering_3_opschorting', (SELECT count(*)::int FROM i WHERE i.stap = 'herinnering_3_opschorting'), 'Open mislukte incasso''s, dag 28'
  UNION ALL SELECT 'prolongatie_jaarpolis', (SELECT count(*)::int FROM p WHERE p.mail), 'BAV-jaarpolissen, 14 dagen voor de verlengdatum'
  UNION ALL SELECT 'prolongatie_geen_bav', (SELECT count(*)::int FROM p WHERE NOT p.mail), 'Geen prolongatiemail (geen BAV-jaarpolis)'
  UNION ALL SELECT 'royement_bevestiging', 0, 'Alleen na de knop Royement bevestigen';
END $f$;
REVOKE ALL ON FUNCTION public.klantmail_verwachting(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klantmail_verwachting(date,date) TO authenticated, service_role;
