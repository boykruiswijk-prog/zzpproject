-- Besluit A12 (Boy 13 okt 2026): KVK API alleen via één kostenbewaakte helper.
ALTER TABLE public.kvk_opvraag_log ADD COLUMN IF NOT EXISTS kosten_eur numeric(6,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.kvk_instellingen (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  dag_limiet integer NOT NULL DEFAULT 100 CHECK (dag_limiet >= 0),
  maand_limiet integer NOT NULL DEFAULT 1000 CHECK (maand_limiet >= 0),
  basis_url text NOT NULL DEFAULT 'https://api.kvk.nl/api/v1',
  prijs_per_bevraging numeric(6,2) NOT NULL DEFAULT 0.02,
  abonnement_per_maand numeric(6,2) NOT NULL DEFAULT 6.40,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.kvk_instellingen TO authenticated;
GRANT ALL ON public.kvk_instellingen TO service_role;
ALTER TABLE public.kvk_instellingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team leest kvk-instellingen" ON public.kvk_instellingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "admin wijzigt kvk-instellingen" ON public.kvk_instellingen FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.kvk_instellingen (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Eén lopende bevraging per KVK-nummer (dedupe bij gelijktijdige aanvragen).
CREATE TABLE IF NOT EXISTS public.kvk_opvraag_claim (
  kvk_nummer text PRIMARY KEY,
  geclaimd_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kvk_opvraag_claim TO service_role;
ALTER TABLE public.kvk_opvraag_claim ENABLE ROW LEVEL SECURITY;

-- Atomaire claim: true = deze aanroeper mag bevragen; verlopen claims (> 60 s) worden overgenomen.
CREATE OR REPLACE FUNCTION public.kvk_claim(_kvk text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    INSERT INTO public.kvk_opvraag_claim (kvk_nummer, geclaimd_op) VALUES (_kvk, now())
    ON CONFLICT (kvk_nummer) DO UPDATE SET geclaimd_op = now()
      WHERE public.kvk_opvraag_claim.geclaimd_op < now() - interval '60 seconds'
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$$;
CREATE OR REPLACE FUNCTION public.kvk_claim_vrijgeven(_kvk text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ DELETE FROM public.kvk_opvraag_claim WHERE kvk_nummer = _kvk; $$;
REVOKE ALL ON FUNCTION public.kvk_claim(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kvk_claim_vrijgeven(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kvk_claim(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.kvk_claim_vrijgeven(text) TO service_role;

-- Betaalde bevragingen vandaag en deze kalendermaand (NL-tijd).
CREATE OR REPLACE FUNCTION public.kvk_betaald_teller() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'dag', count(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Amsterdam')::date = (now() AT TIME ZONE 'Europe/Amsterdam')::date),
    'maand', count(*))
  FROM public.kvk_opvraag_log
  WHERE kosten_eur > 0
    AND created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam');
$$;
REVOKE ALL ON FUNCTION public.kvk_betaald_teller() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kvk_betaald_teller() TO service_role;

-- Overzicht voor beheer: deze maand.
CREATE OR REPLACE FUNCTION public.kvk_kosten_overzicht() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.kvk_instellingen; r jsonb; aan boolean;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO i FROM public.kvk_instellingen WHERE id;
  SELECT coalesce(bool_or(enabled), false) INTO aan FROM public.integratie_config WHERE naam = 'kvk_api';
  SELECT jsonb_build_object(
    'betaald', count(*) FILTER (WHERE kosten_eur > 0),
    'kosten_bevragingen', coalesce(sum(kosten_eur), 0),
    'cache', count(*) FILTER (WHERE uit_cache),
    'geweigerd', count(*) FILTER (WHERE resultaat IN ('limiet','uitgeschakeld','geen_sleutel','ongeldig')),
    'vandaag_betaald', count(*) FILTER (WHERE kosten_eur > 0 AND (created_at AT TIME ZONE 'Europe/Amsterdam')::date = (now() AT TIME ZONE 'Europe/Amsterdam')::date))
  INTO r FROM public.kvk_opvraag_log
  WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam');
  RETURN r || jsonb_build_object('abonnement', i.abonnement_per_maand, 'dag_limiet', i.dag_limiet, 'maand_limiet', i.maand_limiet, 'aan', aan);
END $$;
REVOKE ALL ON FUNCTION public.kvk_kosten_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kvk_kosten_overzicht() TO authenticated;