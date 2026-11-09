CREATE TABLE public.exact_bankgegevens_cache (
  account_id text PRIMARY KEY,
  heeft_rekening boolean NOT NULL DEFAULT false,
  heeft_machtiging boolean NOT NULL DEFAULT false,
  opgehaald_op timestamptz NOT NULL DEFAULT now(),
  sync_run_id uuid
);
COMMENT ON TABLE public.exact_bankgegevens_cache IS 'Alleen of Exact een bankrekening en actieve machtiging heeft (GET via exact-finance-sync). Nooit rekeningnummers.';
GRANT ALL ON public.exact_bankgegevens_cache TO service_role;
ALTER TABLE public.exact_bankgegevens_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incasso_signaal_gezien (
  factuurnummer text PRIMARY KEY,
  eerst_gezien date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Amsterdam')::date)
);
GRANT ALL ON public.incasso_signaal_gezien TO service_role;
ALTER TABLE public.incasso_signaal_gezien ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incasso_daglijst_claim (
  dag date PRIMARY KEY,
  aantal integer NOT NULL,
  melding_id uuid,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.incasso_daglijst_claim TO service_role;
ALTER TABLE public.incasso_daglijst_claim ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mislukte_incassos_kern()
RETURNS TABLE(onderneming_id uuid, klant text, factuurnummer text, bedrag numeric, factuurdatum date, vervaldatum date,
  categorie text, reden text, heeft_rekening boolean, heeft_machtiging boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH vandaag AS (SELECT (now() AT TIME ZONE 'Europe/Amsterdam')::date AS d),
  posten AS (
    SELECT p.* FROM exact_open_posten_cache p
    WHERE p.sync_run_id = public.finance_open_run() AND p.factuurnummer IS NOT NULL AND p.bedrag > 0
      AND p.vervaldatum < (SELECT d FROM vandaag)
  ),
  rijen AS (
    SELECT o.id AS onderneming_id, COALESCE(o.naam, p.account_naam) AS klant, p.factuurnummer, p.bedrag, p.factuurdatum, p.vervaldatum,
      CASE WHEN im.id IS NOT NULL OR COALESCE(b.is_terugboeking, false) THEN 'terugboeking'
           WHEN f.raw->>'PaymentCondition' = 'IN' THEN 'incasso_open'
           WHEN f.raw->>'PaymentCondition' IS NULL THEN 'betaalconditie_onbekend'
           ELSE 'overig' END AS categorie,
      COALESCE(im.reden, NULLIF(trim(p.raw->>'Notes'), '')) AS reden,
      bg.heeft_rekening, bg.heeft_machtiging
    FROM posten p
    LEFT JOIN LATERAL (SELECT * FROM ondernemingen o WHERE (o.exact_account_id::text = p.account_id OR trim(o.exact_relatie_code) = trim(p.account_code)) AND o.samengevoegd_naar IS NULL ORDER BY o.is_test LIMIT 1) o ON true
    LEFT JOIN LATERAL (SELECT * FROM exact_facturen_cache f WHERE f.factuurnummer = p.factuurnummer LIMIT 1) f ON true
    LEFT JOIN LATERAL (SELECT bool_or(b.is_terugboeking) AS is_terugboeking FROM exact_betalingen_cache b WHERE b.factuurnummer = p.factuurnummer) b ON true
    LEFT JOIN LATERAL (SELECT * FROM incasso_mislukt i WHERE i.factuurnummer = p.factuurnummer AND i.status IN ('open','royement_voorgesteld') LIMIT 1) im ON true
    LEFT JOIN exact_bankgegevens_cache bg ON bg.account_id = p.account_id
    WHERE COALESCE(o.is_test, false) = false
  )
  SELECT * FROM rijen WHERE categorie <> 'overig'
  UNION ALL
  SELECT i.onderneming_id, o.naam, i.factuurnummer, i.bedrag, NULL::date, NULL::date, 'terugboeking', i.reden, bg.heeft_rekening, bg.heeft_machtiging
  FROM incasso_mislukt i JOIN ondernemingen o ON o.id = i.onderneming_id
  LEFT JOIN exact_bankgegevens_cache bg ON bg.account_id = o.exact_account_id::text
  WHERE i.status IN ('open','royement_voorgesteld') AND NOT i.is_test
    AND NOT EXISTS (SELECT 1 FROM rijen r WHERE r.factuurnummer = i.factuurnummer)
$$;
REVOKE ALL ON FUNCTION public.mislukte_incassos_kern() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mislukte_incassos_kern() TO service_role;

CREATE OR REPLACE FUNCTION public.mislukte_incassos_overzicht()
RETURNS TABLE(onderneming_id uuid, klant text, factuurnummer text, bedrag numeric, factuurdatum date, vervaldatum date,
  categorie text, reden text, heeft_rekening boolean, heeft_machtiging boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'verzekering')) THEN
    RAISE EXCEPTION 'geen_toegang' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.mislukte_incassos_kern() k ORDER BY k.vervaldatum NULLS FIRST, k.factuurnummer;
END $$;
REVOKE ALL ON FUNCTION public.mislukte_incassos_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mislukte_incassos_overzicht() TO authenticated;

-- Lijst voor Sandra: alleen klant en factuurnummer, nooit rekeningnummers.
CREATE OR REPLACE FUNCTION public.klanten_zonder_bankgegevens()
RETURNS TABLE(klant text, factuurnummer text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'medewerker')) THEN
    RAISE EXCEPTION 'geen_toegang' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT k.klant, k.factuurnummer FROM public.mislukte_incassos_kern() k
    WHERE k.heeft_rekening IS FALSE OR k.heeft_machtiging IS FALSE ORDER BY k.klant, k.factuurnummer;
END $$;
REVOKE ALL ON FUNCTION public.klanten_zonder_bankgegevens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klanten_zonder_bankgegevens() TO authenticated;

-- Dagelijkse melding aan Ellen: maximaal een per NL-dag, alleen nieuwe factuurnummers, geen bedragen of namen.
CREATE OR REPLACE FUNCTION public.incasso_daglijst_melden()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _dag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date; _nieuw text[]; _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM incasso_daglijst_claim WHERE dag = _dag) THEN RETURN 0; END IF;
  WITH n AS (
    INSERT INTO incasso_signaal_gezien(factuurnummer)
    SELECT DISTINCT k.factuurnummer FROM public.mislukte_incassos_kern() k WHERE k.categorie IN ('terugboeking','incasso_open')
    ON CONFLICT DO NOTHING RETURNING factuurnummer)
  SELECT array_agg(factuurnummer ORDER BY factuurnummer) INTO _nieuw FROM n;
  IF COALESCE(array_length(_nieuw,1),0) = 0 THEN RETURN 0; END IF;
  INSERT INTO wijzigingsmeldingen(titel, omschrijving, onderdeel, wat_moet_ellen_doen)
  VALUES ('Nieuwe mislukte incasso''s: ' || array_length(_nieuw,1),
    'Lasso zag vandaag ' || array_length(_nieuw,1) || ' nieuwe mislukte of open incassofactuur/-facturen in Exact: ' || array_to_string(_nieuw[1:20], ', ')
      || CASE WHEN array_length(_nieuw,1) > 20 THEN ' en meer' ELSE '' END || '. Details staan in Admin, Incasso''s, Mislukte incasso''s.',
    'admin', 'Bekijk de nieuwe facturen in Admin, Incasso''s.')
  RETURNING id INTO _id;
  INSERT INTO incasso_daglijst_claim(dag, aantal, melding_id) VALUES (_dag, array_length(_nieuw,1), _id);
  RETURN array_length(_nieuw,1);
END $$;
REVOKE ALL ON FUNCTION public.incasso_daglijst_melden() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incasso_daglijst_melden() TO service_role;

-- Huidige achterstand telt als gezien; alleen nieuwe gevallen leveren een melding op.
INSERT INTO public.incasso_signaal_gezien(factuurnummer)
SELECT DISTINCT factuurnummer FROM public.mislukte_incassos_kern() WHERE categorie IN ('terugboeking','incasso_open') ON CONFLICT DO NOTHING;

SELECT cron.schedule('incasso-daglijst', '15 6 * * *', 'select public.incasso_daglijst_melden()');