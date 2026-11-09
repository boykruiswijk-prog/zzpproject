CREATE SEQUENCE IF NOT EXISTS public.cyber_nummer_seq START 1;
CREATE TABLE public.cyber_nummers (
  onderneming_id uuid PRIMARY KEY REFERENCES public.ondernemingen(id),
  nummer text NOT NULL UNIQUE CHECK (nummer ~ '^ZPCYB[0-9]{4,}$'),
  toegekend_op timestamptz NOT NULL DEFAULT now(),
  toegekend_door uuid,
  reden text NOT NULL,
  laatste_pdf_pad text,
  laatste_pdf_op timestamptz
);
GRANT SELECT ON public.cyber_nummers TO authenticated;
GRANT ALL ON public.cyber_nummers TO service_role;
ALTER TABLE public.cyber_nummers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest cybernummers" ON public.cyber_nummers FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

-- Nummer blijft onveranderbaar; alleen het pad van het laatste document mag mee.
CREATE OR REPLACE FUNCTION public.guard_cyber_nummer() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cybernummer kan niet worden verwijderd'; END IF;
  IF NEW.nummer <> OLD.nummer OR NEW.onderneming_id <> OLD.onderneming_id THEN RAISE EXCEPTION 'Cybernummer is onveranderbaar'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_cyber_nummer BEFORE UPDATE OR DELETE ON public.cyber_nummers FOR EACH ROW EXECUTE FUNCTION public.guard_cyber_nummer();

CREATE OR REPLACE FUNCTION public.klant_dekking_actief(_onderneming_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'bav', EXISTS (SELECT 1 FROM klant_contracten WHERE onderneming_id = _onderneming_id AND product IN ('bav_avb','nimble_bav') AND status IN ('actief','loopt_af')),
    'cyber', EXISTS (SELECT 1 FROM klant_contracten WHERE onderneming_id = _onderneming_id AND product = 'cyber_clear' AND status IN ('actief','loopt_af')),
    'cyber_nummer', (SELECT nummer FROM cyber_nummers WHERE onderneming_id = _onderneming_id))
$$;
REVOKE ALL ON FUNCTION public.klant_dekking_actief(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klant_dekking_actief(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cyber_nummer_toekennen_kern(_onderneming_id uuid, _reden text, _door uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d jsonb; nr text;
BEGIN
  IF length(btrim(coalesce(_reden,''))) < 10 THEN RAISE EXCEPTION 'Reden van minimaal 10 tekens verplicht'; END IF;
  SELECT nummer INTO nr FROM cyber_nummers WHERE onderneming_id = _onderneming_id;
  IF nr IS NOT NULL THEN RETURN nr; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('cyber_nummer_seq'));
  d := klant_dekking_actief(_onderneming_id);
  IF NOT (d->>'cyber')::boolean THEN RAISE EXCEPTION 'Geen actief cybercontract'; END IF;
  IF (d->>'bav')::boolean THEN RAISE EXCEPTION 'Klant heeft BAV + AVB; die houdt het BAV-nummer'; END IF;
  nr := 'ZPCYB' || lpad(nextval('public.cyber_nummer_seq')::text, 4, '0');
  INSERT INTO cyber_nummers (onderneming_id, nummer, toegekend_door, reden) VALUES (_onderneming_id, nr, _door, btrim(_reden));
  INSERT INTO sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('cyber_nummers', _onderneming_id, 'cyber_nummer_toegekend', 'nummer', NULL, nr, _door, CASE WHEN _door IS NULL THEN 'systeem' ELSE get_user_role_label(_door) END, jsonb_build_object('reden', btrim(_reden)));
  RETURN nr;
END $$;
REVOKE ALL ON FUNCTION public.cyber_nummer_toekennen_kern(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_nummer_toekennen_kern(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cyber_nummer_toekennen(_onderneming_id uuid, _reden text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'Tweestapsverificatie vereist'; END IF;
  RETURN public.cyber_nummer_toekennen_kern(_onderneming_id, _reden, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.cyber_nummer_toekennen(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyber_nummer_toekennen(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cyber_pdf_vastleggen(_onderneming_id uuid, _pad text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE cyber_nummers SET laatste_pdf_pad = _pad, laatste_pdf_op = now() WHERE onderneming_id = _onderneming_id
$$;
REVOKE ALL ON FUNCTION public.cyber_pdf_vastleggen(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_pdf_vastleggen(uuid, text) TO service_role;

-- Rapport: alleen-cyberklanten die nog een BAV-nummer hebben (niet automatisch omnummeren).
CREATE OR REPLACE FUNCTION public.alleen_cyber_met_bav_nummer() RETURNS TABLE(onderneming_id uuid, naam text, bav_nummers text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_team_member(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN QUERY
  SELECT o.id, o.naam, string_agg(DISTINCT n.nr, ', ')
  FROM ondernemingen o
  JOIN LATERAL (SELECT p.certificate_number nr FROM policies p WHERE p.onderneming_id = o.id OR p.lead_id IN (SELECT l.id FROM leads l WHERE l.onderneming_id = o.id)
                UNION SELECT k.certificaatnummer FROM klant_certificaten k WHERE k.onderneming_id = o.id) n ON n.nr IS NOT NULL
  WHERE NOT o.is_test AND (klant_dekking_actief(o.id)->>'cyber')::boolean AND NOT (klant_dekking_actief(o.id)->>'bav')::boolean
  GROUP BY o.id, o.naam;
END $$;
REVOKE ALL ON FUNCTION public.alleen_cyber_met_bav_nummer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alleen_cyber_met_bav_nummer() TO authenticated, service_role;