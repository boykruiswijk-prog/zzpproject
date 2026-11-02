CREATE UNIQUE INDEX IF NOT EXISTS crm_notities_review_uniek
  ON public.crm_notities ((details->>'review_verzoek_id'), (details->>'mail'))
  WHERE aangemaakt_door_naam = 'Systeem (reviewverzoek)';

CREATE OR REPLACE FUNCTION public.review_crm_notitie(p_review_verzoek_id uuid, p_mail text, p_message_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE d record; v_tekst text; n int;
BEGIN
  IF p_mail NOT IN ('verzoek','herinnering') THEN RAISE EXCEPTION 'ongeldige mailsoort'; END IF;
  SELECT g.onderneming_id, g.persoon_id, g.ronde INTO d
  FROM review_verzoeken v JOIN review_bestaand_doelgroep g ON g.id = v.doelgroep_id
  WHERE v.id = p_review_verzoek_id;
  IF NOT FOUND OR (d.onderneming_id IS NULL AND d.persoon_id IS NULL) THEN RETURN false; END IF;
  v_tekst := CASE p_mail WHEN 'verzoek'
    THEN 'Reviewverzoek (Google) verstuurd aan bestaande klant, ronde ' || d.ronde || ', namens Ellen Baars.'
    ELSE 'Herinnering reviewverzoek (Google) verstuurd.' END;
  INSERT INTO crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, details, is_test)
  VALUES (d.onderneming_id, d.persoon_id, 'overig', v_tekst,
    '5d591f12-d010-4640-ae68-2b4f58953320', 'Systeem (reviewverzoek)',
    jsonb_build_object('review_verzoek_id', p_review_verzoek_id, 'ronde', d.ronde, 'message_id', p_message_id, 'mail', p_mail), false)
  ON CONFLICT ((details->>'review_verzoek_id'), (details->>'mail')) WHERE aangemaakt_door_naam = 'Systeem (reviewverzoek)' DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

REVOKE ALL ON FUNCTION public.review_crm_notitie(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_crm_notitie(uuid, text, text) TO service_role;