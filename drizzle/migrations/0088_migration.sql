-- Meldingssoorten voor interne meldingen + markering van in Exact verwijderde concepten.
ALTER TABLE public.interne_melding_ontvangers ADD COLUMN IF NOT EXISTS soort text NOT NULL DEFAULT 'algemeen';
ALTER TABLE public.interne_melding_ontvangers DROP CONSTRAINT IF EXISTS interne_melding_ontvangers_soort_check;
ALTER TABLE public.interne_melding_ontvangers ADD CONSTRAINT interne_melding_ontvangers_soort_check CHECK (soort IN ('algemeen','exact_boeking'));
ALTER TABLE public.interne_melding_ontvangers DROP CONSTRAINT IF EXISTS interne_melding_ontvangers_email_key;
ALTER TABLE public.interne_melding_ontvangers ADD CONSTRAINT interne_melding_ontvangers_email_soort_key UNIQUE (email, soort);
INSERT INTO public.interne_melding_ontvangers (email, soort, actief) VALUES ('roxy@onefellow.nl','exact_boeking',true)
ON CONFLICT (email, soort) DO NOTHING;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS exact_invoice_verwijderd_op timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS exact_invoice_gecontroleerd_op timestamptz;
ALTER TABLE public.factuur_planning ADD COLUMN IF NOT EXISTS exact_verwijderd_op timestamptz;
COMMENT ON COLUMN public.leads.exact_invoice_verwijderd_op IS 'Gezet door exact-concept-controle als het concept (exact_invoice_id, bewaard) in Exact 404 geeft.';
COMMENT ON COLUMN public.factuur_planning.exact_verwijderd_op IS 'Gezet door exact-concept-controle als het concept (exact_invoice_id, bewaard) in Exact 404 geeft.';

DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  n := replace(d,
    $a$'Factuur staat klaar in Exact, wacht op verwerking' reden, 'lead' bron
        FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.exact_invoice_id IS NOT NULL AND l.exact_invoice_number IS NULL AND coalesce(l.exact_invoice_status,0) <> 50$a$,
    $b$CASE WHEN l.exact_invoice_verwijderd_op IS NOT NULL THEN 'Concept is in Exact verwijderd, opnieuw klaarzetten of bewust laten vervallen' ELSE 'Factuur staat klaar in Exact, wacht op verwerking' END reden, 'lead' bron
        FROM leads l WHERE (_toon_test OR NOT l.is_test) AND l.exact_invoice_id IS NOT NULL AND l.exact_invoice_number IS NULL AND coalesce(l.exact_invoice_status,0) <> 50
      UNION ALL
      SELECT kc.onderneming_id, coalesce(o.naam,''), o.naam, p.exact_verwijderd_op,
             'Concept is in Exact verwijderd, opnieuw klaarzetten of bewust laten vervallen ('||to_char(p.periode_start,'DD-MM-YYYY')||')', 'planning'
        FROM factuur_planning p JOIN klant_contracten kc ON kc.id = p.klant_contract_id LEFT JOIN ondernemingen o ON o.id = kc.onderneming_id
       WHERE (_toon_test OR NOT p.is_test) AND p.exact_verwijderd_op IS NOT NULL AND p.exact_invoice_number IS NULL AND p.status = 'concept_aangemaakt'$b$);
  IF n = d THEN RAISE EXCEPTION 'mijn_acties_vandaag: verwacht fragment niet gevonden'; END IF;
  EXECUTE n;
END $do$;