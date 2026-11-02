CREATE TABLE public.review_bestaand_doelgroep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  voornaam text,
  onderneming_id uuid NOT NULL,
  persoon_id uuid NOT NULL,
  begin_datum date NOT NULL,
  ronde smallint NOT NULL CHECK (ronde IN (1,2)),
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_bestaand_doelgroep TO authenticated;
GRANT ALL ON public.review_bestaand_doelgroep TO service_role;
ALTER TABLE public.review_bestaand_doelgroep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin leest bestaande-klanten doelgroep" ON public.review_bestaand_doelgroep
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.review_bestaand_doelgroep IS 'Eenmalig bevroren doelgroep reviewverzoek bestaande klanten (Reviews 3, 2-11-2026). Nooit verwijderen.';
CREATE TRIGGER review_bestaand_doelgroep_geen_delete BEFORE DELETE ON public.review_bestaand_doelgroep
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_verzoeken_geen_delete();

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
    AND NOT EXISTS (SELECT 1 FROM public.review_verzoeken r WHERE lower(trim(r.email)) = lower(trim(p.genormaliseerd_email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(p.genormaliseerd_email)))
    AND NOT EXISTS (SELECT 1 FROM public.email_unsubscribe_tokens u WHERE lower(trim(u.email)) = lower(trim(p.genormaliseerd_email)) AND u.used_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.incasso_mislukt im WHERE im.onderneming_id = o.id)
), per_email AS (
  SELECT DISTINCT ON (email) * FROM basis ORDER BY email, begin_datum DESC, onderneming_id, persoon_id
), top AS (
  SELECT *, row_number() OVER (ORDER BY begin_datum DESC, email) AS rn FROM per_email ORDER BY begin_datum DESC, email LIMIT 100
)
SELECT email, voornaam, onderneming_id, persoon_id, begin_datum, CASE WHEN rn <= 50 THEN 1 ELSE 2 END FROM top;

ALTER TABLE public.review_verzoeken ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE public.review_verzoeken ADD COLUMN doelgroep_id uuid UNIQUE REFERENCES public.review_bestaand_doelgroep(id);
ALTER TABLE public.review_verzoeken ADD CONSTRAINT review_verzoeken_bron_check CHECK (lead_id IS NOT NULL OR doelgroep_id IS NOT NULL);
CREATE UNIQUE INDEX review_verzoeken_bestaand_email_uniek ON public.review_verzoeken (lower(trim(email))) WHERE doelgroep_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.review_herinnering_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, lead_id uuid, email text, voornaam text, token text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.lead_id, r.email, coalesce(l.voornaam, d.voornaam), r.token
  FROM public.review_verzoeken r
  LEFT JOIN public.leads l ON l.id = r.lead_id
  LEFT JOIN public.review_bestaand_doelgroep d ON d.id = r.doelgroep_id
  WHERE r.status = 'verstuurd'
    AND r.verstuurd_op <= now() - interval '7 days'
    AND r.geklikt_op IS NULL AND r.herinnering_op IS NULL
    AND (l.id IS NOT NULL OR d.id IS NOT NULL)
    AND (l.id IS NULL OR (l.status <> 'opgezegd' AND coalesce(l.is_test, false) = false))
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(r.email))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(r.email)))
  ORDER BY r.verstuurd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;
REVOKE ALL ON FUNCTION public.review_herinnering_kandidaten(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_herinnering_kandidaten(integer) TO service_role;