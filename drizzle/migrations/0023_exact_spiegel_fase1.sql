CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.ondernemingen
  ADD COLUMN IF NOT EXISTS exact_account_id text,
  ADD COLUMN IF NOT EXISTS exact_account_naam text,
  ADD COLUMN IF NOT EXISTS exact_koppeling_status text,
  ADD COLUMN IF NOT EXISTS exact_naam_gelijkenis numeric;

ALTER TABLE public.klant_contracten
  ADD COLUMN IF NOT EXISTS afas_gefactureerd_tm date,
  ADD COLUMN IF NOT EXISTS afas_volgende_factuurdatum date,
  ADD COLUMN IF NOT EXISTS gefactureerd_tm_bron text NOT NULL DEFAULT 'afas',
  ADD COLUMN IF NOT EXISTS exact_abonnement_id text,
  ADD COLUMN IF NOT EXISTS exact_abonnementsregel_id text;
UPDATE public.klant_contracten SET afas_gefactureerd_tm = gefactureerd_tm, afas_volgende_factuurdatum = volgende_factuurdatum
  WHERE afas_gefactureerd_tm IS NULL;

-- Normalisatie van relatiecodes: trim, hoofdletters, numeriek zonder voorloopnullen
CREATE OR REPLACE FUNCTION public.exact_code_norm(_c text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN btrim(coalesce(_c,'')) = '' THEN NULL
              WHEN btrim(_c) ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(btrim(_c),'0'),''),'0')
              ELSE upper(btrim(_c)) END
$$;

CREATE TABLE public.exact_accounts_spiegel (
  id text PRIMARY KEY, code text, code_norm text, naam text, kvk text, status text,
  is_sales boolean, blocked boolean, raw jsonb, opgehaald_op timestamptz NOT NULL DEFAULT now(), sync_run_id uuid
);
CREATE INDEX exact_accounts_spiegel_code_norm_idx ON public.exact_accounts_spiegel(code_norm);

CREATE TABLE public.exact_abonnementstypes_spiegel (
  id text PRIMARY KEY, code text, omschrijving text, raw jsonb, opgehaald_op timestamptz NOT NULL DEFAULT now(), sync_run_id uuid
);

CREATE TABLE public.exact_artikelen_spiegel (
  id text PRIMARY KEY, code text, omschrijving text, opgehaald_op timestamptz NOT NULL DEFAULT now(), sync_run_id uuid
);

CREATE TABLE public.exact_abonnementen_spiegel (
  entry_id text PRIMARY KEY, nummer text, omschrijving text, ordered_by text, invoice_to text, subscription_type text,
  start_date date, end_date date, cancellation_date date, invoiced_to date, invoiced_to_bron text,
  invoicing_start_date date, invoice_day integer, payment_condition text, classification text, block_entry boolean,
  raw jsonb, opgehaald_op timestamptz NOT NULL DEFAULT now(), sync_run_id uuid
);
CREATE INDEX exact_abon_spiegel_ordered_by_idx ON public.exact_abonnementen_spiegel(ordered_by);

CREATE TABLE public.exact_abonnementsregels_spiegel (
  id text PRIMARY KEY, entry_id text, item text, item_code text, item_omschrijving text, quantity numeric,
  unit_price numeric, net_price numeric, amount_dc numeric, from_date date, to_date date, line_type text,
  unit_code text, vat_code text, raw jsonb, opgehaald_op timestamptz NOT NULL DEFAULT now(), sync_run_id uuid
);
CREATE INDEX exact_abonregels_entry_idx ON public.exact_abonnementsregels_spiegel(entry_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['exact_accounts_spiegel','exact_abonnementstypes_spiegel','exact_artikelen_spiegel','exact_abonnementen_spiegel','exact_abonnementsregels_spiegel'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Team kan spiegel lezen" ON public.%I FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()))', t);
  END LOOP;
END $$;

-- Accountkoppeling (alleen service_role): idempotent, herberekent volledig
CREATE OR REPLACE FUNCTION public.exact_koppel_accounts() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $fn$
BEGIN
  WITH k AS (
    SELECT o.id, count(a.id) n, min(a.id) aid, min(a.naam) anaam
    FROM public.ondernemingen o
    LEFT JOIN public.exact_accounts_spiegel a ON a.code_norm = public.exact_code_norm(o.exact_relatie_code)
    WHERE o.exact_relatie_code IS NOT NULL GROUP BY o.id
  )
  UPDATE public.ondernemingen o SET
    exact_koppeling_status = CASE WHEN k.n = 0 THEN 'niet_gevonden' WHEN k.n > 1 THEN 'dubbel' ELSE 'gekoppeld' END,
    exact_account_id = CASE WHEN k.n = 1 THEN k.aid END,
    exact_account_naam = CASE WHEN k.n = 1 THEN k.anaam END,
    exact_naam_gelijkenis = CASE WHEN k.n = 1 THEN round(similarity(lower(coalesce(o.naam,'')), lower(coalesce(k.anaam,'')))::numeric, 2) END
  FROM k WHERE k.id = o.id;
  RETURN (SELECT jsonb_build_object(
    'gekoppeld', count(*) FILTER (WHERE exact_koppeling_status='gekoppeld'),
    'niet_gevonden', count(*) FILTER (WHERE exact_koppeling_status='niet_gevonden'),
    'dubbel', count(*) FILTER (WHERE exact_koppeling_status='dubbel'),
    'naamverschil', count(*) FILTER (WHERE exact_naam_gelijkenis < 0.6))
    FROM public.ondernemingen WHERE exact_relatie_code IS NOT NULL);
END $fn$;
REVOKE ALL ON FUNCTION public.exact_koppel_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exact_koppel_accounts() TO service_role;

-- Reconciliatie per contractregel en per Exact-regel
CREATE OR REPLACE VIEW public.exact_reconciliatie_v WITH (security_invoker = true) AS
WITH regels AS (
  SELECT l.id regel_id, l.entry_id, l.item_code, l.quantity, l.unit_price, l.amount_dc, l.from_date, l.to_date,
    s.nummer, s.ordered_by, s.start_date, s.end_date, s.cancellation_date, s.invoiced_to, s.invoiced_to_bron,
    CASE WHEN t.omschrijving ~* '(jaar|year|annual|12 ?m)' OR t.code ~* '(jaar|^j|year)' THEN 'jaar'
         WHEN t.omschrijving ~* '(maand|month)' OR t.code ~* '(maand|^m|month)' THEN 'maand' END exact_cyclus
  FROM public.exact_abonnementsregels_spiegel l
  JOIN public.exact_abonnementen_spiegel s ON s.entry_id = l.entry_id
  LEFT JOIN public.exact_abonnementstypes_spiegel t ON t.id = s.subscription_type
),
crm AS (
  SELECT c.*, o.exact_account_id, o.naam klant_naam, o.exact_relatie_code FROM public.klant_contracten c
  JOIN public.ondernemingen o ON o.id = c.onderneming_id WHERE NOT c.is_test
),
m AS (
  SELECT c.id contract_id, r.*,
    row_number() OVER (PARTITION BY c.id ORDER BY (r.nummer = c.abonnement_nr) DESC NULLS LAST, r.from_date DESC NULLS LAST) rn
  FROM crm c JOIN regels r ON r.ordered_by = c.exact_account_id AND upper(btrim(r.item_code)) = upper(btrim(c.itemcode))
),
gekoppeld AS (
  SELECT c.id contract_id, c.onderneming_id, c.klant_naam, c.exact_relatie_code, c.bron_rij, c.itemcode, c.product, c.cyclus,
    c.aantal * c.bedrag_per_periode crm_bedrag, c.gefactureerd_tm crm_gefactureerd_tm, c.status crm_status, c.eind_datum crm_eind,
    m.regel_id, m.entry_id, m.nummer exact_nummer, m.quantity * m.unit_price exact_bedrag, m.exact_cyclus,
    m.invoiced_to exact_invoiced_to, m.invoiced_to_bron, coalesce(m.cancellation_date, m.end_date, m.to_date) exact_eind,
    (coalesce(m.cancellation_date, m.end_date, m.to_date) <= current_date) exact_beeindigd,
    (c.status = 'vervangen' OR c.eind_datum <= current_date) crm_beeindigd
  FROM crm c LEFT JOIN m ON m.contract_id = c.id AND m.rn = 1
),
klas AS (
  SELECT g.*, array_remove(ARRAY[
    CASE WHEN g.regel_id IS NOT NULL AND g.exact_beeindigd IS DISTINCT FROM g.crm_beeindigd AND (g.exact_beeindigd OR g.crm_beeindigd) THEN
      CASE WHEN g.exact_beeindigd THEN 'exact_opgezegd_crm_actief' ELSE 'crm_opgezegd_exact_actief' END END,
    CASE WHEN g.regel_id IS NULL THEN 'alleen_crm' END,
    CASE WHEN g.regel_id IS NOT NULL AND g.exact_cyclus IS NOT NULL AND g.exact_cyclus <> g.cyclus THEN 'cyclusverschil' END,
    CASE WHEN g.regel_id IS NOT NULL AND abs(coalesce(g.exact_bedrag,0) - g.crm_bedrag) > 0.01 THEN 'prijsverschil' END,
    CASE WHEN g.regel_id IS NOT NULL AND (g.exact_invoiced_to IS DISTINCT FROM g.crm_gefactureerd_tm
           OR (g.exact_eind IS DISTINCT FROM g.crm_eind AND g.crm_status <> 'vervangen')) THEN 'datumverschil' END
  ], NULL) verschillen FROM gekoppeld g
)
SELECT 'crm'::text bron, contract_id, onderneming_id, klant_naam, exact_relatie_code, bron_rij, itemcode, product, cyclus, crm_bedrag,
  crm_gefactureerd_tm, crm_status, crm_eind, regel_id, entry_id, exact_nummer, exact_bedrag, exact_cyclus, exact_invoiced_to,
  invoiced_to_bron, exact_eind, coalesce(verschillen[1], 'match') klasse, verschillen
FROM klas
UNION ALL
SELECT 'exact', NULL, o.id, coalesce(o.naam, a.naam), coalesce(o.exact_relatie_code, a.code), NULL, r.item_code, NULL, NULL, NULL,
  NULL, NULL, NULL, r.regel_id, r.entry_id, r.nummer, r.quantity * r.unit_price, r.exact_cyclus, r.invoiced_to,
  r.invoiced_to_bron, coalesce(r.cancellation_date, r.end_date, r.to_date), 'alleen_exact', ARRAY['alleen_exact']
FROM regels r
LEFT JOIN public.exact_accounts_spiegel a ON a.id = r.ordered_by
LEFT JOIN public.ondernemingen o ON o.exact_account_id = r.ordered_by
WHERE NOT EXISTS (SELECT 1 FROM gekoppeld g WHERE g.regel_id = r.regel_id);
GRANT SELECT ON public.exact_reconciliatie_v TO authenticated, service_role;
REVOKE ALL ON public.exact_reconciliatie_v FROM anon;

-- Handmatig overnemen van de Exact-stand (supervisor/admin). Wordt NIET automatisch uitgevoerd.
CREATE OR REPLACE FUNCTION public.neem_exact_stand_over(_contract_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE _uid uuid := auth.uid(); _email text; n int := 0; r record;
BEGIN
  IF _uid IS NULL OR NOT public.is_supervisor_or_admin(_uid) THEN
    RAISE EXCEPTION 'Alleen supervisor/admin' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  FOR r IN SELECT v.contract_id, v.exact_invoiced_to, v.invoiced_to_bron, v.entry_id, v.regel_id, c.gefactureerd_tm oud
           FROM public.exact_reconciliatie_v v JOIN public.klant_contracten c ON c.id = v.contract_id
           WHERE v.contract_id = ANY(_contract_ids) AND v.regel_id IS NOT NULL AND v.exact_invoiced_to IS NOT NULL
             AND v.exact_invoiced_to IS DISTINCT FROM c.gefactureerd_tm LOOP
    UPDATE public.klant_contracten SET gefactureerd_tm = r.exact_invoiced_to, volgende_factuurdatum = r.exact_invoiced_to + 1,
      gefactureerd_tm_bron = CASE WHEN r.invoiced_to_bron = 'afgeleid' THEN 'exact_afgeleid' ELSE 'exact' END,
      exact_abonnement_id = r.entry_id, exact_abonnementsregel_id = r.regel_id
    WHERE id = r.contract_id;
    INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_email,uitgevoerd_door_rol,details)
    VALUES ('klant_contracten', r.contract_id, 'exact_stand_overgenomen', 'gefactureerd_tm', r.oud::text, r.exact_invoiced_to::text, _uid, _email,
            public.get_user_role_label(_uid), jsonb_build_object('bron', coalesce(r.invoiced_to_bron,'exact')));
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('bijgewerkt', n);
END $fn$;
REVOKE ALL ON FUNCTION public.neem_exact_stand_over(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.neem_exact_stand_over(uuid[]) TO authenticated;