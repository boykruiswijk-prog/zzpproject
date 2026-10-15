-- Besluit Boy 15-10-2026 (D1-aanvulling 2): maandpolis en cyber per dag opzegbaar, nooit creditnota.
DO $do$
DECLARE d text; oud text; nieuw text;
BEGIN
  d := pg_get_functiondef('public.plan_opzeg_credit(uuid,uuid,date)'::regprocedure);
  oud := 'IF k.cyber_voorwaarden_versie = ''2026-10-08'' AND k.product = ''cyber_clear'' THEN
    RETURN jsonb_build_object(''status'',''niet_nodig'',''melding'',''Cyber loopt door tot einde cyberjaar; geen tussentijdse creditnota'');
  END IF;';
  nieuw := '-- Cyber (elke versie, maand of jaar): per dag opzegbaar, nooit creditnota. Bestaande rijen blijven ongemoeid.
  IF k.product LIKE ''cyber%'' THEN
    RETURN jsonb_build_object(''status'',''niet_nodig'',''melding'',''Cyber: per dag opzegbaar, nooit creditnota (besluit 15-10-2026)'');
  END IF;
  -- Maandpolis: per dag opzegbaar, geen creditnota. Bestaande rijen blijven ongemoeid.
  IF k.cyclus = ''maand'' THEN
    RETURN jsonb_build_object(''status'',''niet_nodig'',''melding'',''Maandpolis: per dag opzegbaar, geen creditnota (besluit 15-10-2026)'');
  END IF;
  -- D1 jaarpolis, wacht op Boy: crediteren blijft zoals in D1 tot Boy anders besluit.';
  IF position(oud IN d) = 0 THEN RAISE EXCEPTION 'cyberblok plan_opzeg_credit niet gevonden'; END IF;
  EXECUTE replace(d, oud, nieuw);

  -- Per dag opzegbaar voor alle contracten: periode die start na de opzegdatum wordt niet gefactureerd; cyber-uitzondering vervalt.
  d := pg_get_functiondef('public.facturatie_kandidaten(date,date)'::regprocedure);
  oud := '(CASE WHEN p.cyber_voorwaarden_versie = ''2026-10-08'' AND p.product = ''cyber_clear'' AND p.cyclus = ''maand'' THEN public.factuur_periode_eind(p.ps, p.cyclus) > p.opz ELSE p.ps > p.opz END)';
  IF position(oud IN d) = 0 THEN RAISE EXCEPTION 'opzegregel facturatie_kandidaten niet gevonden'; END IF;
  d := replace(d, oud, '(p.ps > p.opz)');
  IF position('factuur_periode_eind(p.ps, p.cyclus) > p.opz' IN d) > 0 THEN RAISE EXCEPTION 'vervanging onvolledig'; END IF;
  EXECUTE d;
END $do$;