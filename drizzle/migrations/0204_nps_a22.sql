ALTER TABLE public.facturatie_config ADD COLUMN IF NOT EXISTS nps_actief boolean NOT NULL DEFAULT false;

CREATE TABLE public.nps_antwoorden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  onderneming_id uuid,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  score smallint CHECK (score BETWEEN 0 AND 10),
  toelichting text CHECK (toelichting IS NULL OR char_length(toelichting) <= 1000),
  status text NOT NULL DEFAULT 'klaargezet' CHECK (status IN ('klaargezet','verstuurd','overgeslagen','beantwoord')),
  verstuurd_op timestamptz,
  beantwoord_op timestamptz,
  kanaal text NOT NULL DEFAULT 'mail' CHECK (kanaal = 'mail'),
  is_test boolean NOT NULL DEFAULT false,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nps_antwoorden_email_idx ON public.nps_antwoorden (lower(email));
GRANT SELECT ON public.nps_antwoorden TO authenticated;
GRANT ALL ON public.nps_antwoorden TO service_role;
REVOKE ALL ON public.nps_antwoorden FROM anon;
ALTER TABLE public.nps_antwoorden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest NPS" ON public.nps_antwoorden FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

ALTER TABLE public.crm_taken DROP CONSTRAINT crm_taken_soort_check;
ALTER TABLE public.crm_taken ADD CONSTRAINT crm_taken_soort_check CHECK (soort = ANY (ARRAY['exact_aanpassen','nieuwe_aanvraag_nodig','afas_factuur_opvragen','incasso_mislukt_bellen','royement_bevestigen','nps_laag_bellen']));

-- Kandidaten: eenmaal per klant, 30 dagen na activatie, zelfde uitsluitingen als reviewverzoeken.
CREATE OR REPLACE FUNCTION public.nps_kandidaten(_limit integer DEFAULT 50)
RETURNS TABLE(lead_id uuid, onderneming_id uuid, email text, voornaam text, geactiveerd_op timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.gekoppeld_onderneming_id, trim(l.email), l.voornaam, l.geactiveerd_op
  FROM public.leads l
  WHERE l.type = 'verzekering_aanvraag'
    AND coalesce(l.is_test, false) = false
    AND l.geactiveerd_op IS NOT NULL
    AND l.geactiveerd_op <= now() - interval '30 days'
    AND l.geactiveerd_op >= now() - interval '37 days'
    AND l.status NOT IN ('opgezegd','gepauzeerd')
    AND coalesce(trim(l.email), '') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.review_afmeldingen a WHERE a.email = lower(trim(l.email)))
    AND NOT EXISTS (SELECT 1 FROM public.nps_antwoorden n WHERE n.lead_id = l.id OR lower(n.email) = lower(trim(l.email))
                      OR (l.gekoppeld_onderneming_id IS NOT NULL AND n.onderneming_id = l.gekoppeld_onderneming_id))
  ORDER BY l.geactiveerd_op
  LIMIT greatest(1, least(coalesce(_limit, 50), 50))
$$;
REVOKE ALL ON FUNCTION public.nps_kandidaten(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nps_kandidaten(integer) TO service_role;

-- Score/toelichting via token (alleen publieke edge function). Lage score: een open beltaak per klant.
CREATE OR REPLACE FUNCTION public.nps_antwoord_opslaan(_token text, _score integer DEFAULT NULL, _toelichting text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.nps_antwoorden; v_klant text; v_taak boolean := false;
BEGIN
  IF _score IS NOT NULL AND (_score < 0 OR _score > 10) THEN RAISE EXCEPTION 'ongeldige score' USING ERRCODE='22023'; END IF;
  SELECT * INTO n FROM public.nps_antwoorden WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','ongeldig'); END IF;
  IF _score IS NOT NULL THEN
    UPDATE public.nps_antwoorden SET score = _score, status = 'beantwoord', beantwoord_op = coalesce(beantwoord_op, now()) WHERE id = n.id;
    IF _score <= 6 AND NOT EXISTS (
      SELECT 1 FROM public.crm_taken t WHERE t.soort = 'nps_laag_bellen' AND t.status = 'open'
        AND ((n.onderneming_id IS NOT NULL AND t.onderneming_id = n.onderneming_id) OR t.details->>'lead_id' = n.lead_id::text)) THEN
      SELECT coalesce(nullif(trim(l.bedrijfsnaam),''), trim(coalesce(l.voornaam,'')||' '||coalesce(l.achternaam,''))) INTO v_klant FROM public.leads l WHERE l.id = n.lead_id;
      INSERT INTO public.crm_taken (soort, onderneming_id, omschrijving, details, is_test, team, aangemaakt_door_naam)
      VALUES ('nps_laag_bellen', n.onderneming_id, 'NPS laag: bellen',
              jsonb_build_object('lead_id', n.lead_id, 'nps_id', n.id, 'score', _score, 'klant', v_klant), n.is_test, NULL, 'NPS');
      v_taak := true;
    END IF;
  ELSIF _toelichting IS NOT NULL THEN
    IF n.score IS NULL THEN RETURN jsonb_build_object('status','eerst_score'); END IF;
    UPDATE public.nps_antwoorden SET toelichting = left(trim(_toelichting), 1000) WHERE id = n.id;
  END IF;
  RETURN jsonb_build_object('status','opgeslagen','taak',v_taak);
END $$;
REVOKE ALL ON FUNCTION public.nps_antwoord_opslaan(text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nps_antwoord_opslaan(text,integer,text) TO service_role;

-- Dashboardtegel: laatste 90 dagen, zonder testdata, alleen supervisor/admin met tweestapscode.
CREATE OR REPLACE FUNCTION public.nps_overzicht()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_verstuurd int; v_antw int; v_pro int; v_det int;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2'
     OR NOT (public.has_role(auth.uid(),'supervisor'::public.app_role) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Geen toegang tot NPS' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) FILTER (WHERE verstuurd_op >= now() - interval '90 days'),
         count(*) FILTER (WHERE score IS NOT NULL AND beantwoord_op >= now() - interval '90 days'),
         count(*) FILTER (WHERE score >= 9 AND beantwoord_op >= now() - interval '90 days'),
         count(*) FILTER (WHERE score <= 6 AND beantwoord_op >= now() - interval '90 days')
    INTO v_verstuurd, v_antw, v_pro, v_det
    FROM public.nps_antwoorden WHERE is_test = false;
  RETURN jsonb_build_object(
    'nps', CASE WHEN v_antw > 0 THEN round(100.0 * (v_pro - v_det) / v_antw) END,
    'antwoorden', v_antw, 'verstuurd', v_verstuurd, 'promotors', v_pro, 'criticasters', v_det,
    'respons_pct', CASE WHEN v_verstuurd > 0 THEN round(100.0 * v_antw / v_verstuurd, 1) END,
    'actief', (SELECT nps_actief FROM public.facturatie_config WHERE id = 1));
END $$;
REVOKE ALL ON FUNCTION public.nps_overzicht() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nps_overzicht() TO authenticated;

-- Vandaag te doen: bestaande opbouw ongewijzigd, NPS-beltaken als extra onderdeel.
ALTER FUNCTION public.mijn_acties_vandaag(boolean) RENAME TO mijn_acties_vandaag_basis;
REVOKE ALL ON FUNCTION public.mijn_acties_vandaag_basis(boolean) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.mijn_acties_vandaag(_toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; c jsonb;
BEGIN
  r := public.mijn_acties_vandaag_basis(_toon_test);
  _toon_test := coalesce((r->>'toon_test')::boolean, false);
  WITH b AS (SELECT * FROM crm_taken t WHERE t.status = 'open' AND t.soort = 'nps_laag_bellen' AND (_toon_test OR NOT t.is_test))
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'onderneming_id', onderneming_id, 'lead_id', details->>'lead_id', 'naam', details->>'klant',
      'score', details->'score', 'sinds', aangemaakt_op) ORDER BY aangemaakt_op) FROM (SELECT * FROM b ORDER BY aangemaakt_op LIMIT 10) s), '[]'::jsonb)) INTO c;
  RETURN r || jsonb_build_object('nps', c, 'totaal', coalesce((r->>'totaal')::int, 0) + (c->>'aantal')::int);
END $$;
REVOKE ALL ON FUNCTION public.mijn_acties_vandaag(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_acties_vandaag(boolean) TO authenticated;
