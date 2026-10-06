CREATE TABLE public.review_afmeldingen (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  afgemeld_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.review_afmeldingen TO service_role;
ALTER TABLE public.review_afmeldingen ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.review_afmeldingen IS 'Afmeldingen uitsluitend voor reviewverzoeken; geen andere mailfunctie filtert hierop.';

CREATE OR REPLACE FUNCTION public.review_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(lead_id uuid, email text, voornaam text, geactiveerd_op timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.email, l.voornaam, l.geactiveerd_op
  FROM public.leads l
  WHERE l.type = 'verzekering_aanvraag'
    AND coalesce(l.is_test, false) = false
    AND l.created_at >= '2026-10-06'
    AND l.geactiveerd_op IS NOT NULL
    AND l.geactiveerd_op <= now() - interval '2 days'
    AND l.geactiveerd_op >= now() - interval '30 days'
    AND l.status NOT IN ('opgezegd','gepauzeerd')
    AND coalesce(trim(l.email), '') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_verzoeken r WHERE r.lead_id = l.id)
  ORDER BY l.geactiveerd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;

CREATE OR REPLACE FUNCTION public.review_herinnering_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, lead_id uuid, email text, voornaam text, token text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.lead_id, r.email, l.voornaam, r.token
  FROM public.review_verzoeken r JOIN public.leads l ON l.id = r.lead_id
  WHERE r.status = 'verstuurd'
    AND r.verstuurd_op <= now() - interval '7 days'
    AND r.geklikt_op IS NULL AND r.herinnering_op IS NULL
    AND l.status <> 'opgezegd'
    AND coalesce(l.is_test, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(r.email))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(r.email)))
  ORDER BY r.verstuurd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;