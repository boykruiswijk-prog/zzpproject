CREATE TABLE public.aov_aanmeldingen (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 naam text NOT NULL CHECK (char_length(btrim(naam)) BETWEEN 2 AND 120),
 email text NOT NULL CHECK (char_length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
 telefoon text NULL CHECK (telefoon IS NULL OR telefoon ~ '^[0-9+ ()-]{8,20}$'),
 toestemming_doorgeven boolean NOT NULL CHECK (toestemming_doorgeven),
 toestemming_tekst text NOT NULL CHECK (char_length(toestemming_tekst) BETWEEN 20 AND 500),
 doel text NOT NULL CHECK (doel IN ('rekentool','advies')),
 bron text NOT NULL CHECK (char_length(bron) BETWEEN 1 AND 800),
 user_id uuid NULL,
 status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw','doorgegeven','polis','geen_polis')),
 notitie text NULL CHECK (notitie IS NULL OR char_length(notitie) <= 1000),
 behandeld_door uuid NULL,
 behandeld_op timestamptz NULL
);
GRANT SELECT, UPDATE ON public.aov_aanmeldingen TO authenticated;
GRANT ALL ON public.aov_aanmeldingen TO service_role;
ALTER TABLE public.aov_aanmeldingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AOV aanmelding admin lezen" ON public.aov_aanmeldingen FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin') AND (SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY "AOV aanmelding admin bijwerken" ON public.aov_aanmeldingen FOR UPDATE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin') AND (SELECT auth.jwt()->>'aal') = 'aal2') WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX aov_aanmeldingen_created_at_idx ON public.aov_aanmeldingen (created_at DESC);
CREATE INDEX aov_aanmeldingen_email_idx ON public.aov_aanmeldingen (lower(email));

-- Enige publieke schrijfroute: valideert, beperkt per IP en registreert de doorklik met dezelfde ref.
CREATE FUNCTION public.aov_aanmelden(p_naam text, p_email text, p_telefoon text, p_toestemming boolean, p_toestemming_tekst text, p_doel text, p_bron text, p_honeypot text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 v_id uuid := gen_random_uuid();
 v_ip text;
 v_tel text := nullif(btrim(coalesce(p_telefoon,'')), '');
 v_tekst constant text := 'Ik geef ZP Zaken toestemming mijn naam en contactgegevens door te geven aan Tjepkema Assurantie & Advies B.V. (WijZijnAOV), zodat ik de Movir Momentum AOV via hen kan berekenen en afsluiten.';
BEGIN
 IF coalesce(p_honeypot,'') <> '' THEN RAISE EXCEPTION 'aov_ongeldig' USING ERRCODE = '22023'; END IF;
 IF p_toestemming IS NOT TRUE OR p_toestemming_tekst IS DISTINCT FROM v_tekst THEN RAISE EXCEPTION 'aov_toestemming' USING ERRCODE = '22023'; END IF;
 IF p_doel NOT IN ('rekentool','advies') THEN RAISE EXCEPTION 'aov_ongeldig' USING ERRCODE = '22023'; END IF;
 IF char_length(btrim(coalesce(p_naam,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'aov_naam' USING ERRCODE = '22023'; END IF;
 IF char_length(coalesce(p_email,'')) > 254 OR btrim(lower(coalesce(p_email,''))) !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' THEN RAISE EXCEPTION 'aov_email' USING ERRCODE = '22023'; END IF;
 IF v_tel IS NOT NULL AND v_tel !~ '^[0-9+ ()-]{8,20}$' THEN RAISE EXCEPTION 'aov_telefoon' USING ERRCODE = '22023'; END IF;
 v_ip := left(coalesce(split_part((current_setting('request.headers', true)::json->>'x-forwarded-for'), ',', 1), 'onbekend'), 64);
 IF (SELECT count(*) FROM public.form_rate_limit WHERE ip = v_ip AND kind = 'aov_aanmelding' AND created_at > now() - interval '10 minutes') >= 5 THEN
  RAISE EXCEPTION 'aov_limiet' USING ERRCODE = '22023';
 END IF;
 INSERT INTO public.form_rate_limit (ip, kind) VALUES (v_ip, 'aov_aanmelding');
 INSERT INTO public.aov_aanmeldingen (id, naam, email, telefoon, toestemming_doorgeven, toestemming_tekst, doel, bron, user_id)
 VALUES (v_id, btrim(p_naam), btrim(lower(p_email)), v_tel, true, v_tekst, p_doel, left(coalesce(nullif(p_bron,''),'/aov'), 800), auth.uid());
 INSERT INTO public.aov_doorverwijzingen (klik_id, bron, doel, user_id) VALUES (v_id, left(coalesce(nullif(p_bron,''),'/aov'), 800), p_doel, auth.uid());
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.aov_aanmelden(text,text,text,boolean,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aov_aanmelden(text,text,text,boolean,text,text,text,text) TO anon, authenticated, service_role;

CREATE FUNCTION public.aov_aanmeldingen_overzicht()
RETURNS TABLE(id uuid, created_at timestamptz, naam text, email text, telefoon text, doel text, bron text, user_id uuid, status text, notitie text, behandeld_op timestamptz, lead_id uuid, lead_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.id, a.created_at, a.naam, a.email, a.telefoon, a.doel, a.bron, a.user_id, a.status, a.notitie, a.behandeld_op, l.id, l.status::text
 FROM public.aov_aanmeldingen a
 LEFT JOIN LATERAL (SELECT x.id, x.status FROM public.leads x WHERE lower(x.email) = lower(a.email) AND coalesce(x.is_test,false) = false ORDER BY (x.status = 'klant') DESC, x.created_at DESC LIMIT 1) l ON true
 WHERE public.has_role(auth.uid(), 'admin') AND (auth.jwt()->>'aal') = 'aal2'
 ORDER BY a.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.aov_aanmeldingen_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aov_aanmeldingen_overzicht() TO authenticated, service_role;

CREATE FUNCTION public.aov_aanmelding_bijwerken(p_id uuid, p_status text, p_notitie text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') OR coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'geen_toegang' USING ERRCODE = '42501'; END IF;
 IF p_status NOT IN ('nieuw','doorgegeven','polis','geen_polis') THEN RAISE EXCEPTION 'ongeldige_status' USING ERRCODE = '22023'; END IF;
 UPDATE public.aov_aanmeldingen SET status = p_status, notitie = nullif(left(btrim(coalesce(p_notitie,'')), 1000), ''), behandeld_door = auth.uid(), behandeld_op = now() WHERE id = p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'niet_gevonden' USING ERRCODE = 'P0002'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.aov_aanmelding_bijwerken(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aov_aanmelding_bijwerken(uuid,text,text) TO authenticated, service_role;