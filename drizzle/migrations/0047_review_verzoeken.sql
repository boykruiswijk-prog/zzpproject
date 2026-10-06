CREATE TABLE public.review_verzoeken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'verstuurd' CHECK (status IN ('verstuurd','herinnerd','afgemeld','overgeslagen')),
  verstuurd_op timestamptz,
  herinnering_op timestamptz,
  geklikt_op timestamptz,
  platform text NOT NULL DEFAULT 'google',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(token) >= 32)
);
GRANT SELECT ON public.review_verzoeken TO authenticated;
GRANT ALL ON public.review_verzoeken TO service_role;
ALTER TABLE public.review_verzoeken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest reviewverzoeken" ON public.review_verzoeken
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE INDEX review_verzoeken_email_idx ON public.review_verzoeken (lower(email));

-- Nooit verwijderen
CREATE OR REPLACE FUNCTION public.guard_review_verzoeken_geen_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'review_verzoeken: verwijderen is niet toegestaan'; END $$;
CREATE TRIGGER review_verzoeken_geen_delete BEFORE DELETE ON public.review_verzoeken
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_verzoeken_geen_delete();

-- Weggeklikte reviewkaart per klant
CREATE TABLE public.review_kaart_verborgen (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verborgen_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.review_kaart_verborgen TO service_role;
ALTER TABLE public.review_kaart_verborgen ENABLE ROW LEVEL SECURITY;

-- Schakelaar (admin-only via bestaande integratie_config-policy)
INSERT INTO public.integratie_config (naam, enabled, notities)
VALUES ('reviewverzoeken_actief', true, 'Automatisch reviewverzoek aan nieuwe klanten na activatie')
ON CONFLICT DO NOTHING;

-- Klantportaal: kaart tonen?
CREATE OR REPLACE FUNCTION public.mijn_review_kaart()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'tonen', auth.uid() IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.review_kaart_verborgen v WHERE v.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.leads l JOIN public.policies p ON p.lead_id = l.id
                  WHERE p.user_id = auth.uid() AND l.status IN ('actief','klant')),
    'token', (SELECT r.token FROM public.review_verzoeken r JOIN public.policies p ON p.lead_id = r.lead_id
              WHERE p.user_id = auth.uid() ORDER BY r.created_at DESC LIMIT 1)
  )
$$;
REVOKE ALL ON FUNCTION public.mijn_review_kaart() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_review_kaart() TO authenticated;

CREATE OR REPLACE FUNCTION public.verberg_review_kaart()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet ingelogd'; END IF;
  INSERT INTO public.review_kaart_verborgen (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.verberg_review_kaart() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verberg_review_kaart() TO authenticated;

-- Kandidaten voor eerste verzoek (alleen service_role)
CREATE OR REPLACE FUNCTION public.review_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(lead_id uuid, email text, voornaam text, geactiveerd_op timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
    AND NOT EXISTS (SELECT 1 FROM public.review_verzoeken r WHERE r.lead_id = l.id)
  ORDER BY l.geactiveerd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;
REVOKE ALL ON FUNCTION public.review_kandidaten(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_kandidaten(integer) TO service_role;

-- Kandidaten voor de eenmalige herinnering (alleen service_role)
CREATE OR REPLACE FUNCTION public.review_herinnering_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, lead_id uuid, email text, voornaam text, token text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id, r.lead_id, r.email, l.voornaam, r.token
  FROM public.review_verzoeken r JOIN public.leads l ON l.id = r.lead_id
  WHERE r.status = 'verstuurd'
    AND r.verstuurd_op <= now() - interval '7 days'
    AND r.geklikt_op IS NULL AND r.herinnering_op IS NULL
    AND l.status <> 'opgezegd'
    AND coalesce(l.is_test, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(r.email))
  ORDER BY r.verstuurd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;
REVOKE ALL ON FUNCTION public.review_herinnering_kandidaten(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_herinnering_kandidaten(integer) TO service_role;