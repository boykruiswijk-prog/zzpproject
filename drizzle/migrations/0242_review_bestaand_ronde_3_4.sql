ALTER TABLE public.review_bestaand_doelgroep DROP CONSTRAINT review_bestaand_doelgroep_ronde_check;
ALTER TABLE public.review_bestaand_doelgroep ADD CONSTRAINT review_bestaand_doelgroep_ronde_check CHECK (ronde IN (1,2,3,4));
COMMENT ON TABLE public.review_bestaand_doelgroep IS 'Bevroren doelgroep reviewverzoek bestaande klanten: ronde 1-2 (Reviews 3, 2-11-2026), ronde 3-4 (Reviews 4, 4-11-2026). Nooit verwijderen.';

INSERT INTO public.review_bestaand_doelgroep (email, voornaam, onderneming_id, persoon_id, begin_datum, ronde)
WITH basis AS (
  SELECT lower(trim(p.genormaliseerd_email)) AS email, nullif(trim(p.voornaam),'') AS voornaam,
         o.id AS onderneming_id, p.id AS persoon_id, kc.begin_datum
  FROM public.personen p
  JOIN public.persoon_onderneming po ON po.persoon_id = p.id
  JOIN public.ondernemingen o ON o.id = po.onderneming_id
  JOIN public.klant_contracten kc ON kc.onderneming_id = o.id
  WHERE coalesce(o.is_test,false)=false AND o.samengevoegd_naar IS NULL AND o.facturatie_blokkade IS NULL
    AND kc.status='actief' AND coalesce(kc.is_test,false)=false AND kc.product ILIKE 'bav%' AND kc.begin_datum < '2026-10-12'
    AND coalesce(p.is_test,false)=false
    AND p.genormaliseerd_email LIKE '%@%'
    AND lower(p.genormaliseerd_email) NOT LIKE '%@zpzaken.nl' AND lower(p.genormaliseerd_email) NOT LIKE '%@onefellow.nl'
    AND NOT EXISTS (SELECT 1 FROM public.review_bestaand_doelgroep d WHERE d.email = lower(trim(p.genormaliseerd_email)) OR d.onderneming_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM public.review_verzoeken r WHERE lower(trim(r.email)) = lower(trim(p.genormaliseerd_email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(p.genormaliseerd_email)))
    AND NOT EXISTS (SELECT 1 FROM public.email_unsubscribe_tokens u WHERE lower(trim(u.email)) = lower(trim(p.genormaliseerd_email)) AND u.used_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.incasso_mislukt im WHERE im.onderneming_id = o.id)
), per_onderneming AS (
  SELECT DISTINCT ON (onderneming_id) * FROM basis ORDER BY onderneming_id, begin_datum DESC, email, persoon_id
), per_email AS (
  SELECT DISTINCT ON (email) * FROM per_onderneming ORDER BY email, begin_datum DESC, onderneming_id, persoon_id
), top AS (
  SELECT *, row_number() OVER (ORDER BY begin_datum DESC, email) AS rn FROM per_email ORDER BY begin_datum DESC, email LIMIT 100
)
SELECT email, voornaam, onderneming_id, persoon_id, begin_datum, CASE WHEN rn <= 50 THEN 3 ELSE 4 END FROM top;