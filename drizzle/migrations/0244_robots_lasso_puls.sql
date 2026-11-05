-- A30 Lasso / Opvolger: maximaal twee interne signalen per open item.
CREATE TABLE public.opvolg_signalen (
  item_soort text NOT NULL CHECK (item_soort IN ('concept','terugbel','offerte')),
  item_id uuid NOT NULL,
  signaal_1_op timestamptz,
  signaal_2_op timestamptz,
  PRIMARY KEY (item_soort, item_id)
);
GRANT SELECT ON public.opvolg_signalen TO authenticated;
GRANT ALL ON public.opvolg_signalen TO service_role;
ALTER TABLE public.opvolg_signalen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest opvolgsignalen" ON public.opvolg_signalen FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'admin'));

-- Open items (gedeelde definitie voor ronde en adminoverzicht).
CREATE OR REPLACE FUNCTION public.opvolg_open_basis()
RETURNS TABLE(item_soort text, item_id uuid, aangemaakt_op timestamptz, stap smallint, pakket text, naam text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'concept', c.id, c.created_at, coalesce(c.max_stap, c.stap), c.pakket,
         nullif(trim(concat_ws(' ', c.voornaam, c.achternaam, CASE WHEN c.bedrijfsnaam IS NOT NULL THEN '('||c.bedrijfsnaam||')' END)), '')
  FROM aanvraag_concepten c
  WHERE NOT coalesce(c.is_test,false) AND c.spam_signaal IS NULL AND c.lead_id IS NULL AND c.dubbel_lead_id IS NULL
    AND c.opgevolgd_op IS NULL AND c.afgerond_op IS NULL AND c.converted_at IS NULL AND c.geanonimiseerd_op IS NULL
    AND coalesce(c.status,'') NOT IN ('afgerond','omgezet')
    AND c.created_at < now() - interval '2 hours' AND c.created_at > now() - interval '14 days'
  UNION ALL
  SELECT CASE WHEN l.type::text = 'offerte-aanvraag' THEN 'offerte' ELSE 'terugbel' END, l.id, l.created_at, NULL::smallint,
         l.extra_data->>'pakket', nullif(trim(concat_ws(' ', l.voornaam, l.achternaam)), '')
  FROM leads l
  WHERE NOT coalesce(l.is_test,false) AND l.status::text = 'nieuw'
    AND (l.type::text = 'offerte-aanvraag' OR (l.type::text = 'contact' AND l.extra_data->>'formulier_naam' ILIKE 'Terugbelverzoek%'))
    AND l.created_at < now() - interval '2 hours' AND l.created_at > now() - interval '14 days';
$$;
REVOKE ALL ON FUNCTION public.opvolg_open_basis() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opvolg_open_basis() TO service_role;

-- Ronde: legt signaal 1 (na 2 uur) en signaal 2 (na 24 uur) vast. Geeft telling plus te melden items zonder persoonsgegevens.
CREATE OR REPLACE FUNCTION public.opvolger_ronde()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int; v_oudste numeric; v_items jsonb; v_nieuw int; v_tweede int;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  CREATE TEMP TABLE _open ON COMMIT DROP AS SELECT * FROM public.opvolg_open_basis();
  SELECT count(*), round(coalesce(max(extract(epoch FROM now()-aangemaakt_op)/3600),0)::numeric,1) INTO v_open, v_oudste FROM _open;
  WITH s1 AS (
    INSERT INTO opvolg_signalen(item_soort,item_id,signaal_1_op)
    SELECT item_soort, item_id, now() FROM _open
    ON CONFLICT (item_soort,item_id) DO NOTHING RETURNING item_soort, item_id, 1 AS signaal),
  s2 AS (
    UPDATE opvolg_signalen s SET signaal_2_op = now() FROM _open o
    WHERE s.item_soort=o.item_soort AND s.item_id=o.item_id AND s.signaal_2_op IS NULL
      AND s.signaal_1_op IS NOT NULL AND s.signaal_1_op < now() - interval '1 minute'
      AND o.aangemaakt_op < now() - interval '24 hours'
    RETURNING s.item_soort, s.item_id, 2 AS signaal),
  alle AS (SELECT * FROM s1 UNION ALL SELECT * FROM s2)
  SELECT coalesce(jsonb_agg(jsonb_build_object('soort',a.item_soort,'id',a.item_id,'signaal',a.signaal,
           'uren_open',round((extract(epoch FROM now()-o.aangemaakt_op)/3600)::numeric,1),'stap',o.stap,'pakket',o.pakket)
           ORDER BY o.aangemaakt_op),'[]'::jsonb),
         count(*) FILTER (WHERE a.signaal=1), count(*) FILTER (WHERE a.signaal=2)
    INTO v_items, v_nieuw, v_tweede
  FROM alle a JOIN _open o ON o.item_soort=a.item_soort AND o.item_id=a.item_id;
  RETURN jsonb_build_object('open',v_open,'nieuw_gesignaleerd',v_nieuw,'tweede_signaal',v_tweede,'oudste_open_uren',v_oudste,'items',v_items);
END $$;
REVOKE ALL ON FUNCTION public.opvolger_ronde() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opvolger_ronde() TO authenticated, service_role;

-- Adminoverzicht Opvolgen (team met 2FA), oudste eerst.
CREATE OR REPLACE FUNCTION public.opvolg_overzicht()
RETURNS TABLE(item_soort text, item_id uuid, aangemaakt_op timestamptz, stap smallint, pakket text, naam text, signaal_1_op timestamptz, signaal_2_op timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ((public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'admin'))
          AND coalesce(auth.jwt()->>'aal','') = 'aal2') THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT o.item_soort, o.item_id, o.aangemaakt_op, o.stap, o.pakket, o.naam, s.signaal_1_op, s.signaal_2_op
    FROM public.opvolg_open_basis() o LEFT JOIN opvolg_signalen s USING (item_soort, item_id)
    ORDER BY o.aangemaakt_op ASC;
END $$;
REVOKE ALL ON FUNCTION public.opvolg_overzicht() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opvolg_overzicht() TO authenticated;

-- A31 Puls / Hartslag.
CREATE TABLE public.hartslag_metingen (
  id bigserial PRIMARY KEY,
  gemeten_op timestamptz NOT NULL DEFAULT now(),
  onderdeel text NOT NULL,
  ok boolean NOT NULL,
  reden text
);
CREATE INDEX hartslag_metingen_onderdeel_tijd ON public.hartslag_metingen (onderdeel, gemeten_op DESC);
GRANT SELECT ON public.hartslag_metingen TO authenticated;
GRANT ALL ON public.hartslag_metingen TO service_role;
GRANT USAGE ON SEQUENCE public.hartslag_metingen_id_seq TO service_role;
ALTER TABLE public.hartslag_metingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest hartslag" ON public.hartslag_metingen FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.hartslag_opruimen()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM hartslag_metingen WHERE gemeten_op < now() - interval '14 days' RETURNING 1) SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.hartslag_opruimen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hartslag_opruimen() TO service_role;

CREATE OR REPLACE FUNCTION public.hartslag_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('onderdeel', onderdeel, 'metingen', metingen,
           'rood', jsonb_array_length(metingen) = 2 AND NOT (metingen->0->>'ok')::boolean AND NOT (metingen->1->>'ok')::boolean) ORDER BY onderdeel)
    FROM (SELECT onderdeel, jsonb_agg(jsonb_build_object('op', gemeten_op, 'ok', ok, 'reden', reden) ORDER BY gemeten_op DESC) metingen
          FROM (SELECT *, row_number() OVER (PARTITION BY onderdeel ORDER BY gemeten_op DESC) rn FROM hartslag_metingen) x
          WHERE rn <= 2 GROUP BY onderdeel) y), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.hartslag_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hartslag_status() TO authenticated, service_role;