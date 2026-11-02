-- Beveiligingscheck 2-11 (akkoord Boy): herinneringsmail alleen vanaf stap 2, misbruikrem per IP-hash,
-- spamsignalen uitgesloten en afmeldlijst. Plus eenmalige groep 26-10 t/m 31-10.
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS spam_signaal text;
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS spam_signaal_op timestamptz;
CREATE INDEX IF NOT EXISTS aanvraag_concepten_ip_hash_idx ON public.aanvraag_concepten (ip_hash) WHERE ip_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.herinnering_afmeld_tokens (
  token text PRIMARY KEY CHECK (token ~ '^[a-f0-9]{64}$'),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS herinnering_afmeld_tokens_email_idx ON public.herinnering_afmeld_tokens (lower(btrim(email)));
CREATE TABLE IF NOT EXISTS public.herinnering_afmeldingen (
  email text PRIMARY KEY,
  afgemeld_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.herinnering_afmeld_tokens TO service_role;
GRANT ALL ON public.herinnering_afmeldingen TO service_role;
ALTER TABLE public.herinnering_afmeld_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herinnering_afmeldingen ENABLE ROW LEVEL SECURITY;

-- Gedeelde uitsluitingen (geldig adres, geen test, geen lead/klant, nooit eerder gemaild, niet afgemeld, geen spam).
CREATE OR REPLACE FUNCTION public.afhaak_basis_toegestaan(_c public.aanvraag_concepten)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT btrim(coalesce(_c.email,'')) ~ '^[^\s@<>(),;:"\[\]]+@[^\s@<>(),;:"\[\]]+\.[A-Za-z]{2,}$'
    AND length(btrim(_c.email)) <= 254
    AND NOT coalesce(_c.is_test, false)
    AND lower(btrim(_c.email)) NOT LIKE '%@zpzaken.nl'
    AND _c.geanonimiseerd_op IS NULL
    AND coalesce(_c.status,'open') NOT IN ('omgezet','dubbel')
    AND _c.lead_id IS NULL AND _c.converted_at IS NULL AND _c.herinnering_verstuurd_op IS NULL
    AND _c.spam_signaal IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.aanvraag_concepten s WHERE _c.ip_hash IS NOT NULL AND s.ip_hash = _c.ip_hash AND s.spam_signaal IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.herinnering_afmeldingen a WHERE a.email = lower(btrim(_c.email)))
    AND NOT EXISTS (SELECT 1 FROM public.aanvraag_concepten c2 WHERE lower(btrim(c2.email)) = lower(btrim(_c.email)) AND c2.herinnering_verstuurd_op IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.lead_notification_log g WHERE g.lead_type = 'afhaak_herinnering' AND lower(btrim(g.recipient)) = lower(btrim(_c.email)))
    -- Misbruikrem: per IP-hash max 3 per uur en 10 per dag.
    AND (_c.ip_hash IS NULL OR (
      (SELECT count(*) FROM public.aanvraag_concepten r WHERE r.ip_hash = _c.ip_hash AND r.herinnering_verstuurd_op >= now() - interval '1 hour') < 3
      AND (SELECT count(*) FROM public.aanvraag_concepten r WHERE r.ip_hash = _c.ip_hash AND r.herinnering_verstuurd_op >= now() - interval '1 day') < 10))
$$;
REVOKE ALL ON FUNCTION public.afhaak_basis_toegestaan(public.aanvraag_concepten) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.afhaak_basis_toegestaan(public.aanvraag_concepten) TO service_role;

CREATE OR REPLACE FUNCTION public.afhaak_herinnering_kandidaten(_nu timestamptz DEFAULT now(), _limit integer DEFAULT 25)
RETURNS TABLE(id uuid, email text, voornaam text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.email, k.voornaam FROM (
    SELECT DISTINCT ON (lower(btrim(c.email))) c.id, btrim(c.email) AS email, nullif(btrim(c.voornaam),'') AS voornaam, c.laatst_actief_op
    FROM public.aanvraag_concepten c
    CROSS JOIN (SELECT herinnering_afhaak_vanaf AS vanaf FROM public.facturatie_config WHERE id = 1) cfg
    WHERE cfg.vanaf IS NOT NULL
      AND c.created_at >= cfg.vanaf
      AND c.laatst_actief_op <= _nu - interval '2 hours'
      AND c.laatst_actief_op >= _nu - interval '24 hours'
      AND coalesce(c.max_stap, c.stap) >= 2
      AND public.afhaak_basis_toegestaan(c)
      AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE lower(btrim(l.email)) = lower(btrim(c.email)) AND l.created_at >= c.created_at)
    ORDER BY lower(btrim(c.email)), c.laatst_actief_op DESC
  ) k ORDER BY k.laatst_actief_op LIMIT greatest(1, least(coalesce(_limit,25), 100));
$$;

CREATE OR REPLACE FUNCTION public.afhaak_herinnering_claim(_id uuid, _nu timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text; h text;
BEGIN
  SELECT lower(btrim(email)), ip_hash INTO e, h FROM public.aanvraag_concepten WHERE id = _id;
  IF e IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('afhaak_herinnering:' || e));
  IF h IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('afhaak_herinnering_ip:' || h)); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.afhaak_herinnering_kandidaten(_nu, 100) k WHERE k.id = _id) THEN RETURN false; END IF;
  UPDATE public.aanvraag_concepten SET herinnering_verstuurd_op = _nu WHERE id = _id AND herinnering_verstuurd_op IS NULL;
  RETURN FOUND;
END $$;

-- Eenmalige groep (besluit Boy 2-11): aangemaakt 26-10 t/m 31-10 (NL), ook stap 1, geen lead of klant met dit adres.
CREATE OR REPLACE FUNCTION public.afhaak_eenmalig_kandidaten()
RETURNS TABLE(id uuid, email text, voornaam text, stap smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (lower(btrim(c.email))) c.id, btrim(c.email), nullif(btrim(c.voornaam),''), coalesce(c.max_stap, c.stap)
  FROM public.aanvraag_concepten c
  WHERE (c.created_at AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN date '2026-10-26' AND date '2026-10-31'
    AND coalesce(c.max_stap, c.stap) >= 1
    AND public.afhaak_basis_toegestaan(c)
    AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE lower(btrim(l.email)) = lower(btrim(c.email)))
    AND NOT EXISTS (SELECT 1 FROM public.ondernemingen o WHERE lower(btrim(o.factuur_email)) = lower(btrim(c.email)))
    AND NOT EXISTS (SELECT 1 FROM public.personen p WHERE lower(btrim(p.genormaliseerd_email)) = lower(btrim(c.email)) OR lower(btrim(p.email_weergave)) = lower(btrim(c.email)))
  ORDER BY lower(btrim(c.email)), c.laatst_actief_op DESC
$$;

CREATE OR REPLACE FUNCTION public.afhaak_eenmalig_claim(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text;
BEGIN
  SELECT lower(btrim(email)) INTO e FROM public.aanvraag_concepten WHERE id = _id;
  IF e IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('afhaak_herinnering:' || e));
  IF NOT EXISTS (SELECT 1 FROM public.afhaak_eenmalig_kandidaten() k WHERE k.id = _id) THEN RETURN false; END IF;
  UPDATE public.aanvraag_concepten SET herinnering_verstuurd_op = now() WHERE id = _id AND herinnering_verstuurd_op IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.afhaak_eenmalig_kandidaten() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.afhaak_eenmalig_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.afhaak_eenmalig_kandidaten() TO service_role;
GRANT EXECUTE ON FUNCTION public.afhaak_eenmalig_claim(uuid) TO service_role;