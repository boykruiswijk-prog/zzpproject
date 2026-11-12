-- Activatie: een sterke route (gekoppelde onderneming, Exact-relatiecode of KvK) met precies één onderneming gaat voor;
-- anders alle routes samen precies één. Persoon met eenmanszaak en bv blijft zo eenduidig via het KvK-nummer van de aanvraag.
CREATE OR REPLACE FUNCTION public.policy_onderneming_afleiden(_lead uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sterk AS (
    SELECT l.gekoppeld_onderneming_id o FROM leads l WHERE l.id = _lead AND l.gekoppeld_onderneming_id IS NOT NULL
    UNION SELECT o.id FROM leads l JOIN ondernemingen o ON o.exact_relatie_code = l.exact_relatie_code WHERE l.id = _lead AND coalesce(l.exact_relatie_code,'') <> ''
    UNION SELECT o.id FROM leads l JOIN ondernemingen o ON o.kvk = l.kvk_nummer WHERE l.id = _lead AND coalesce(l.kvk_nummer,'') <> ''
  ), alle AS (
    SELECT o FROM sterk
    UNION SELECT po.onderneming_id FROM persoon_bron_koppeling k JOIN persoon_onderneming po ON po.persoon_id = k.persoon_id WHERE k.bron_tabel = 'leads' AND k.bron_id = _lead
  ),
  hs AS (SELECT DISTINCT coalesce(o.samengevoegd_naar, o.id) id FROM sterk JOIN ondernemingen o ON o.id = sterk.o),
  ha AS (SELECT DISTINCT coalesce(o.samengevoegd_naar, o.id) id FROM alle JOIN ondernemingen o ON o.id = alle.o)
  SELECT CASE WHEN (SELECT count(*) FROM hs) = 1 THEN (SELECT id FROM hs)
              WHEN (SELECT count(*) FROM hs) = 0 AND (SELECT count(*) FROM ha) = 1 THEN (SELECT id FROM ha) END
$$;
REVOKE ALL ON FUNCTION public.policy_onderneming_afleiden(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.policy_onderneming_afleiden(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._ts_certificaat(p_naam text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ond_a constant uuid := '7e570000-0000-4000-8000-00000000000a';
  ond_b constant uuid := '7e570000-0000-4000-8000-00000000000b';
  c jsonb := '[]'; l uuid; p uuid; k uuid; v jsonb; res jsonb; f text;
BEGIN
  IF p_naam IN ('certificaat_polis_via_lead', 'certificaat_ingangsdatum') THEN
    INSERT INTO leads (voornaam, achternaam, email, bedrijfsnaam, kvk_nummer, is_test)
      VALUES ('Testpersoon', 'ZP Zaken', 'test+testpersoon@zpzaken.nl', 'Testpersoon ZP Zaken', '99000101', true) RETURNING id INTO l;
    INSERT INTO policies (certificate_number, certificate_holder, insured_name, start_date, profession, status, lead_id, is_test)
      VALUES ('ZPBAV990011', 'Testpersoon ZP Zaken', 'Testpersoon ZP Zaken', '2026-12-01', 'Testberoep', 'geldig', l, true) RETURNING id INTO p;
    c := c || public._ts_c('activatie zet onderneming_id via lead', ond_a::text, (SELECT onderneming_id::text FROM policies WHERE id = p));
    -- Oude situatie nabootsen: polis alleen aan de lead gekoppeld.
    UPDATE policies SET onderneming_id = NULL WHERE id = p;
  END IF;

  IF p_naam = 'certificaat_polis_via_lead' THEN
    v := public.certificaatnummer_voorstel(ond_a, NULL);
    c := c || public._ts_c('dialoog vindt bestaand nummer via onderneming', 'ZPBAV990011', v->>'nummer')
           || public._ts_c('nummer staat al op een geldige polis', 'true', v->>'staat_al_op_policy')
           || public._ts_c('nieuw nummer niet toegestaan', 'ZPBAV990011', public.bestaand_geldig_bav_nummer(ond_a, NULL));
    f := public._ts_fout(format($q$INSERT INTO policies (certificate_number, certificate_holder, insured_name, start_date, profession, status, onderneming_id, is_test)
           VALUES ('NIEUW','x','x','2026-12-01','x','geldig',%L,true)$q$, ond_a));
    c := c || public._ts_c('Ja, nieuw nummer uitgeven geweigerd', 'true', (coalesce(f, '') LIKE 'Deze klant heeft al een geldig certificaat (ZPBAV990011)%')::text);
  ELSIF p_naam = 'certificaat_ingangsdatum' THEN
    k := public._ts_contract(ond_a, '2026-12-01');
    res := public.contract_wijzig_ingangsdatum(k, '2026-11-30', 'Scenario: certificaat met zelfde nummer');
    c := c || public._ts_c('polis zonder onderneming_id krijgt nieuwe datum', '2026-11-30', (SELECT start_date::text FROM policies WHERE id = p))
           || public._ts_c('nummer ongewijzigd', 'ZPBAV990011', (SELECT certificate_number FROM policies WHERE id = p))
           || public._ts_c('certificaatdialoog opent met hetzelfde nummer', 'ZPBAV990011', public.certificaatnummer_voorstel(ond_a, NULL)->>'nummer')
           || public._ts_c('aantal geldige polissen van deze klant', '1', (SELECT count(*)::text FROM policies WHERE status = 'geldig' AND (onderneming_id = ond_a OR lead_id = l)));
  ELSIF p_naam = 'certificaat_nieuwe_klant' THEN
    v := public.certificaatnummer_voorstel(ond_b, NULL);
    c := c || public._ts_c('echt nieuwe klant: geen bekend nummer', NULL, v->>'nummer')
           || public._ts_c('nieuw nummer toegestaan', NULL, public.bestaand_geldig_bav_nummer(ond_b, NULL));
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public._ts_certificaat(text) FROM PUBLIC, anon, authenticated;