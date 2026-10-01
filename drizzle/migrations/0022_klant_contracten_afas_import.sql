ALTER TABLE public.ondernemingen
  ADD COLUMN IF NOT EXISTS exact_relatie_code text,
  ADD COLUMN IF NOT EXISTS afas_contactpersoon text,
  ADD COLUMN IF NOT EXISTS bron text,
  ADD COLUMN IF NOT EXISTS afwijkingen text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS ondernemingen_exact_relatie_code_uniek
  ON public.ondernemingen (exact_relatie_code) WHERE exact_relatie_code IS NOT NULL;

CREATE TABLE public.klant_contracten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  bron text NOT NULL,
  bron_rij integer NOT NULL,
  abonnement_nr text,
  type text NOT NULL CHECK (type IN ('verzekering','lidmaatschap')),
  itemcode text NOT NULL,
  product text NOT NULL CHECK (product IN ('bav_avb','cyber_clear','lidmaatschap_allin','lidmaatschap_startup','lidmaatschap_light','nimble_bav','onbekend')),
  cyclus text NOT NULL CHECK (cyclus IN ('maand','jaar')),
  aantal numeric NOT NULL DEFAULT 1,
  bedrag_per_periode numeric NOT NULL DEFAULT 0,
  org_prijs numeric,
  afw_prijs numeric,
  maandwaarde numeric GENERATED ALWAYS AS (round(bedrag_per_periode * aantal / CASE WHEN cyclus = 'jaar' THEN 12 ELSE 1 END, 4)) STORED,
  begin_datum date,
  eind_datum date,
  factureren_vanaf date,
  gefactureerd_tm date,
  laatst_gefactureerd_bedrag numeric,
  volgende_factuurdatum date,
  status text NOT NULL DEFAULT 'actief' CHECK (status IN ('actief','loopt_af','vervangen')),
  facturatie_status text NOT NULL DEFAULT 'wacht_op_akkoord',
  afwijkingen text[] NOT NULL DEFAULT '{}',
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bron, bron_rij)
);
CREATE INDEX klant_contracten_onderneming_idx ON public.klant_contracten(onderneming_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.klant_contracten TO authenticated;
GRANT ALL ON public.klant_contracten TO service_role;
ALTER TABLE public.klant_contracten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team kan klantcontracten bekijken" ON public.klant_contracten FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin kan klantcontracten invoegen" ON public.klant_contracten FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan klantcontracten wijzigen" ON public.klant_contracten FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));

CREATE TRIGGER trg_klant_contracten_updated BEFORE UPDATE ON public.klant_contracten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alleen-lezen mandaatkoppeling op relatiecode
CREATE VIEW public.klant_mandaat_v WITH (security_invoker = true) AS
  SELECT DISTINCT ON (relatiecode) relatiecode, iban, kenmerk, ondertekend_op, status
  FROM public.exact_mandaat_import ORDER BY relatiecode, ondertekend_op DESC;
GRANT SELECT ON public.klant_mandaat_v TO authenticated;

-- Import (alleen service_role). Schrijft uitsluitend ondernemingen, personen, persoon_onderneming, klant_contracten.
CREATE OR REPLACE FUNCTION public.importeer_afas_20261001()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_ond_nieuw int; v_ond_totaal int; v_pers_nieuw int; v_kopp_nieuw int; v_contr int;
  r record;
BEGIN
  CREATE TEMP TABLE _sel ON COMMIT DROP AS
  SELECT t.rij, f,
    trim(f[2]) AS relcode,
    to_date(nullif(trim(f[9]),''),'YYYYMMDD') d_begin,
    to_date(nullif(trim(f[10]),''),'YYYYMMDD') d_eind,
    to_date(nullif(trim(f[16]),''),'YYYYMMDD') d_vanaf,
    to_date(nullif(trim(f[17]),''),'YYYYMMDD') d_tm,
    nullif(lower(trim(f[22])),'') m1, nullif(lower(trim(f[23])),'') m2
  FROM (SELECT rij, string_to_array(regel,'~') f FROM import_afas.ruw_20261001) t
  WHERE f[7] IN ('V','L') AND f[8] <> 'TESTAB01' AND coalesce(trim(f[17]),'') <> '';

  -- Ondernemingen: gegevens van de eerste regel per relatiecode
  CREATE TEMP TABLE _rel ON COMMIT DROP AS
  SELECT DISTINCT ON (relcode) relcode, trim(f[4]) naam, nullif(trim(f[5]),'') contact,
    coalesce(m1, m2) hoofdmail,
    CASE WHEN m1 IS NOT NULL AND m2 IS NOT NULL AND m2 <> m1 THEN m2 END tweedemail
  FROM _sel ORDER BY relcode, rij;

  WITH ins AS (
    INSERT INTO public.ondernemingen (exact_relatie_code, naam, afas_contactpersoon, bron)
    SELECT relcode, naam, contact, 'afas_20261001' FROM _rel
    ON CONFLICT (exact_relatie_code) WHERE exact_relatie_code IS NOT NULL
    DO UPDATE SET naam = EXCLUDED.naam, afas_contactpersoon = EXCLUDED.afas_contactpersoon, bron = EXCLUDED.bron
    RETURNING (xmax = 0) nieuw
  ) SELECT count(*) FILTER (WHERE nieuw), count(*) INTO v_ond_nieuw, v_ond_totaal FROM ins;

  -- Personen: dedupe op genormaliseerd e-mailadres
  CREATE TEMP TABLE _mail ON COMMIT DROP AS
  SELECT relcode, hoofdmail mail, contact FROM _rel WHERE hoofdmail IS NOT NULL
  UNION ALL SELECT relcode, tweedemail, NULL FROM _rel WHERE tweedemail IS NOT NULL;

  WITH nieuw AS (
    SELECT DISTINCT ON (mail) mail, contact FROM _mail
    WHERE NOT EXISTS (SELECT 1 FROM public.personen p WHERE p.genormaliseerd_email = _mail.mail)
    ORDER BY mail, (contact IS NULL), relcode
  ), ins AS (
    INSERT INTO public.personen (genormaliseerd_email, email_weergave, voornaam, achternaam)
    SELECT mail, mail,
      CASE WHEN contact IS NOT NULL THEN split_part(contact,' ',1) END,
      CASE WHEN contact IS NOT NULL AND position(' ' in contact) > 0 THEN substr(contact, position(' ' in contact)+1) END
    FROM nieuw RETURNING 1
  ) SELECT count(*) INTO v_pers_nieuw FROM ins;

  -- Naam aanvullen op bestaande personen (alleen als leeg)
  UPDATE public.personen p SET
    voornaam = split_part(m.contact,' ',1),
    achternaam = CASE WHEN position(' ' in m.contact) > 0 THEN substr(m.contact, position(' ' in m.contact)+1) END
  FROM (SELECT DISTINCT ON (mail) mail, contact FROM _mail WHERE contact IS NOT NULL ORDER BY mail, relcode) m
  WHERE p.genormaliseerd_email = m.mail AND p.voornaam IS NULL AND p.achternaam IS NULL;

  WITH ins AS (
    INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT DISTINCT ON (p.id, o.id) p.id, o.id
    FROM _mail m
    JOIN public.ondernemingen o ON o.exact_relatie_code = m.relcode
    JOIN LATERAL (SELECT id FROM public.personen WHERE genormaliseerd_email = m.mail ORDER BY created_at LIMIT 1) p ON true
    ON CONFLICT (persoon_id, onderneming_id) DO NOTHING RETURNING 1
  ) SELECT count(*) INTO v_kopp_nieuw FROM ins;

  -- Contractregels
  INSERT INTO public.klant_contracten (onderneming_id, bron, bron_rij, abonnement_nr, type, itemcode, product, cyclus,
    aantal, bedrag_per_periode, org_prijs, afw_prijs, begin_datum, eind_datum, factureren_vanaf, gefactureerd_tm,
    laatst_gefactureerd_bedrag, volgende_factuurdatum, status, afwijkingen)
  SELECT o.id, 'afas_20261001', s.rij, nullif(trim(s.f[6]),''),
    CASE s.f[7] WHEN 'V' THEN 'verzekering' ELSE 'lidmaatschap' END,
    trim(s.f[8]), x.product,
    CASE trim(s.f[11]) WHEN 'J' THEN 'jaar' ELSE 'maand' END,
    coalesce(nullif(replace(trim(s.f[12]),',','.'),'')::numeric, 1),
    coalesce(nullif(replace(trim(s.f[15]),',','.'),'')::numeric, 0),
    nullif(replace(trim(s.f[13]),',','.'),'')::numeric,
    nullif(replace(trim(s.f[14]),',','.'),'')::numeric,
    coalesce(to_date(nullif(trim(s.f[19]),''),'YYYYMMDD'), s.d_begin), s.d_eind, s.d_vanaf, s.d_tm,
    nullif(replace(trim(s.f[18]),',','.'),'')::numeric,
    s.d_tm + 1,
    CASE WHEN s.rij = 609 THEN 'vervangen' WHEN s.d_eind IS NOT NULL THEN 'loopt_af' ELSE 'actief' END,
    array_remove(ARRAY[
      CASE WHEN s.rij = 609 THEN 'verouderde periode, vervangen door rij 610' END,
      CASE WHEN s.rij = 610 THEN 'facturatie loopt achter' END,
      CASE WHEN s.rij = 1092 THEN 'correctieregel' END,
      CASE WHEN s.rij IN (960, 1978) THEN 'cyclus wijkt af van product' END,
      CASE WHEN s.d_eind IS NOT NULL THEN 'loopt af op ' || to_char(s.d_eind,'DD-MM-YYYY') END,
      CASE WHEN x.product = 'onbekend' THEN 'onbekende itemcode' END
    ], NULL)
  FROM _sel s
  JOIN public.ondernemingen o ON o.exact_relatie_code = s.relcode
  CROSS JOIN LATERAL (SELECT CASE
      WHEN trim(s.f[8]) IN ('100M','100J','100J495','100HDI','100-OUD') OR trim(s.f[8]) LIKE '100-OUDJ%' OR trim(s.f[8]) LIKE '100-OUDM%' THEN 'bav_avb'
      WHEN trim(s.f[8]) IN ('102J','102-OUD') THEN 'cyber_clear'
      WHEN trim(s.f[8]) = '450' THEN 'lidmaatschap_allin'
      WHEN trim(s.f[8]) = '400' THEN 'lidmaatschap_startup'
      WHEN trim(s.f[8]) = '425' THEN 'lidmaatschap_light'
      WHEN trim(s.f[8]) = 'Nimble' THEN 'nimble_bav'
      ELSE 'onbekend' END product) x
  ON CONFLICT (bron, bron_rij) DO UPDATE SET
    onderneming_id = EXCLUDED.onderneming_id, abonnement_nr = EXCLUDED.abonnement_nr, type = EXCLUDED.type,
    itemcode = EXCLUDED.itemcode, product = EXCLUDED.product, cyclus = EXCLUDED.cyclus, aantal = EXCLUDED.aantal,
    bedrag_per_periode = EXCLUDED.bedrag_per_periode, org_prijs = EXCLUDED.org_prijs, afw_prijs = EXCLUDED.afw_prijs,
    begin_datum = EXCLUDED.begin_datum, eind_datum = EXCLUDED.eind_datum, factureren_vanaf = EXCLUDED.factureren_vanaf,
    gefactureerd_tm = EXCLUDED.gefactureerd_tm, laatst_gefactureerd_bedrag = EXCLUDED.laatst_gefactureerd_bedrag,
    volgende_factuurdatum = EXCLUDED.volgende_factuurdatum, status = EXCLUDED.status, afwijkingen = EXCLUDED.afwijkingen;
  GET DIAGNOSTICS v_contr = ROW_COUNT;

  -- Afwijkingen op klantniveau (volledig herberekend = idempotent)
  UPDATE public.ondernemingen o SET afwijkingen = array_remove(ARRAY[
      CASE WHEN r2.hoofdmail IS NULL THEN 'geen e-mail' END,
      CASE WHEN o.exact_relatie_code IN ('2007261','2009368') THEN 'relatiewissel: GG Tech 2007261 loopt af, gaat verder als 2009368' END,
      CASE WHEN EXISTS (SELECT 1 FROM _mail a JOIN _mail b ON a.mail = b.mail AND a.relcode <> b.relcode WHERE a.relcode = o.exact_relatie_code) THEN 'e-mail gedeeld' END,
      CASE WHEN EXISTS (SELECT 1 FROM public.leads l WHERE l.exact_relatie_code = o.exact_relatie_code) THEN 'mogelijke match' END
    ], NULL)
  FROM _rel r2 WHERE r2.relcode = o.exact_relatie_code;

  RETURN jsonb_build_object(
    'geselecteerde_regels', (SELECT count(*) FROM _sel),
    'relaties', (SELECT count(*) FROM _rel),
    'ondernemingen_nieuw', v_ond_nieuw, 'ondernemingen_bijgewerkt', v_ond_totaal - v_ond_nieuw,
    'personen_nieuw', v_pers_nieuw, 'koppelingen_nieuw', v_kopp_nieuw,
    'contractregels_upsert', v_contr,
    'mogelijke_match', (SELECT count(*) FROM public.ondernemingen WHERE 'mogelijke match' = ANY(afwijkingen))
  );
END $fn$;
REVOKE ALL ON FUNCTION public.importeer_afas_20261001() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importeer_afas_20261001() TO service_role;

-- Reconciliatie (alleen team)
CREATE OR REPLACE FUNCTION public.get_klant_contracten_reconciliatie()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_team_member(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  WITH s AS (
    SELECT f, coalesce(nullif(replace(trim(f[15]),',','.'),'')::numeric,0) * coalesce(nullif(replace(trim(f[12]),',','.'),'')::numeric,1) w
    FROM (SELECT string_to_array(regel,'~') f FROM import_afas.ruw_20261001) t
    WHERE f[7] IN ('V','L') AND f[8] <> 'TESTAB01' AND coalesce(trim(f[17]),'') <> ''
  ), c AS (SELECT * , bedrag_per_periode*aantal w FROM public.klant_contracten WHERE bron = 'afas_20261001' AND NOT is_test)
  SELECT jsonb_build_object(
    'bron', (SELECT jsonb_build_object('regels', count(*), 'relaties', count(DISTINCT trim(f[2])),
        'mrr', round(sum(CASE WHEN f[11]='J' THEN w/12 ELSE w END),2), 'arr', round(sum(CASE WHEN f[11]='J' THEN w ELSE w*12 END),2)) FROM s),
    'crm', (SELECT jsonb_build_object('regels', count(*), 'relaties', count(DISTINCT onderneming_id),
        'mrr', round(sum(CASE WHEN cyclus='jaar' THEN w/12 ELSE w END),2), 'arr', round(sum(CASE WHEN cyclus='jaar' THEN w ELSE w*12 END),2)) FROM c),
    'actief', (SELECT jsonb_build_object('regels', count(*), 'relaties', count(DISTINCT onderneming_id),
        'mrr', round(sum(CASE WHEN cyclus='jaar' THEN w/12 ELSE w END),2), 'arr', round(sum(CASE WHEN cyclus='jaar' THEN w ELSE w*12 END),2)) FROM c WHERE status <> 'vervangen'),
    'per_product', (SELECT coalesce(jsonb_agg(jsonb_build_object('product', product, 'regels', n, 'mrr', mrr, 'arr', arr) ORDER BY product), '[]'::jsonb)
        FROM (SELECT product, count(*) n, round(sum(CASE WHEN cyclus='jaar' THEN w/12 ELSE w END),2) mrr, round(sum(CASE WHEN cyclus='jaar' THEN w ELSE w*12 END),2) arr
              FROM c WHERE status <> 'vervangen' GROUP BY product) p)
  ) INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.get_klant_contracten_reconciliatie() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_klant_contracten_reconciliatie() TO authenticated, service_role;