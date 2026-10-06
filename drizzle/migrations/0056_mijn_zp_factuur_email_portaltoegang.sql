ALTER TABLE public.klant_service_aanvragen DROP CONSTRAINT klant_service_aanvragen_type_check;
ALTER TABLE public.klant_service_aanvragen ADD CONSTRAINT klant_service_aanvragen_type_check CHECK (type = ANY (ARRAY['certificaat','pauzeren','documenten','opzeggen','portaltoegang','factuur_opvragen']));

ALTER TABLE public.ondernemingen ADD COLUMN IF NOT EXISTS factuur_email text;
COMMENT ON COLUMN public.ondernemingen.factuur_email IS 'Ontvanger factuurmails uit het platform en toegestaan Mijn ZP-loginadres voor deze onderneming.';
CREATE INDEX IF NOT EXISTS ondernemingen_factuur_email_idx ON public.ondernemingen (lower(factuur_email));

-- Say Yup B.V.: factuur-e-mail op verzoek (casus Joey van Dijk), met audit en taak voor Roxy
UPDATE public.ondernemingen SET factuur_email = 'finance@sayyup.nl' WHERE id = 'dd2d17b6-f276-4496-9912-71dbc6de66a7' AND factuur_email IS NULL;
INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
VALUES ('ondernemingen','dd2d17b6-f276-4496-9912-71dbc6de66a7','gegevens_gewijzigd','factuur_email',NULL,'finance@sayyup.nl','5d591f12-d010-4640-ae68-2b4f58953320','admin', jsonb_build_object('reden','opdracht Boy, casus Joey van Dijk'));
INSERT INTO public.crm_notities (onderneming_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
VALUES ('dd2d17b6-f276-4496-9912-71dbc6de66a7','overig','Gegevens gewijzigd door Boy Kruiswijk:\n- factuur_email: - -> finance@sayyup.nl','5d591f12-d010-4640-ae68-2b4f58953320','Boy Kruiswijk',false, jsonb_build_object('soort','gegevenswijziging'));
INSERT INTO public.crm_taken (soort, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam)
VALUES ('exact_aanpassen','dd2d17b6-f276-4496-9912-71dbc6de66a7','Factuur-e-mail ook in Exact aanpassen: finance@sayyup.nl (Say Yup B.V., relatie 1000578)', jsonb_build_object('velden', jsonb_build_array('factuur_email')), '5d591f12-d010-4640-ae68-2b4f58953320','Boy Kruiswijk');

DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.crm_gegevens_wijzigen(uuid,uuid,jsonb)'::regprocedure);
  n := replace(d, $a$ARRAY['naam','kvk','rechtsvorm','straat','huisnummer','postcode','plaats','iban'];$a$, $a$ARRAY['naam','kvk','rechtsvorm','straat','huisnummer','postcode','plaats','iban','factuur_email'];$a$);
  n := replace(n, $a$IF k = 'email_weergave' AND v IS NOT NULL$a$, $a$IF k = 'factuur_email' AND v IS NOT NULL THEN v := lower(v); END IF;
    IF k IN ('email_weergave','factuur_email') AND v IS NOT NULL$a$);
  n := replace(n, $a$IF k IN ('naam','straat','huisnummer','postcode','plaats','iban') THEN$a$, $a$IF k IN ('naam','straat','huisnummer','postcode','plaats','iban','factuur_email') THEN$a$);
  IF (length(n) - length(d)) < 50 THEN RAISE EXCEPTION 'vervanging mislukt'; END IF;
  EXECUTE n;
END $do$;

-- Klant (Mijn ZP) vraagt oude factuur op; begrensd op 3 per dag
CREATE OR REPLACE FUNCTION public.portal_factuur_opvragen(_toelichting text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE me uuid := auth.uid(); v_email text; v_ond uuid; n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'niet ingelogd'; END IF;
  IF length(coalesce(_toelichting,'')) > 500 THEN RAISE EXCEPTION 'toelichting maximaal 500 tekens'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = me;
  SELECT count(*) INTO n FROM klant_service_aanvragen WHERE user_id = me AND type = 'factuur_opvragen' AND created_at > now() - interval '1 day';
  IF n >= 3 THEN RAISE EXCEPTION 'Je hebt vandaag al een aanvraag gedaan. We nemen contact met je op.'; END IF;
  SELECT coalesce(
    (SELECT id FROM ondernemingen WHERE lower(factuur_email) = v_email AND NOT is_test LIMIT 1),
    (SELECT po.onderneming_id FROM personen p JOIN persoon_onderneming po ON po.persoon_id = p.id WHERE p.genormaliseerd_email = v_email AND NOT p.is_test LIMIT 1)) INTO v_ond;
  INSERT INTO klant_service_aanvragen (type, voornaam, achternaam, email, telefoon, polisnummer, details, status, user_id, onderneming_id, koppeling_status, geverifieerd)
  VALUES ('factuur_opvragen', '', '', v_email, '', '', jsonb_build_object('toelichting', nullif(btrim(coalesce(_toelichting,'')),''), 'bron', 'mijn_zp', 'periode', 'voor oktober 2026'), 'nieuw', me, v_ond,
    CASE WHEN v_ond IS NULL THEN NULL ELSE 'zeker' END, true);
  RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.portal_factuur_opvragen(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.portal_factuur_opvragen(text) TO authenticated;