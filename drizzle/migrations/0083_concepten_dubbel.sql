ALTER TABLE public.aanvraag_concepten DROP CONSTRAINT IF EXISTS aanvraag_concepten_status_check;
ALTER TABLE public.aanvraag_concepten ADD CONSTRAINT aanvraag_concepten_status_check CHECK (status = ANY (ARRAY['open','omgezet','gebeld','geen_interesse','onbereikbaar','dubbel']));
ALTER TABLE public.aanvraag_concepten ADD COLUMN IF NOT EXISTS dubbel_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.concept_afgeronde_leads(_ids uuid[])
RETURNS TABLE(concept_id uuid, lead_id uuid, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (c.id) c.id, l.id, l.created_at
  FROM aanvraag_concepten c JOIN leads l ON l.type = 'verzekering_aanvraag' AND NOT l.is_test
   AND ((c.email IS NOT NULL AND lower(trim(l.email)) = lower(trim(c.email)))
     OR (nullif(regexp_replace(coalesce(c.kvk,''),'\D','','g'),'') IS NOT NULL AND regexp_replace(coalesce(l.kvk_nummer,''),'\D','','g') = regexp_replace(c.kvk,'\D','','g')))
  WHERE c.id = ANY(_ids)
  ORDER BY c.id, l.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.concept_afgeronde_leads(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concept_afgeronde_leads(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.sluit_dubbele_concepten() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type <> 'verzekering_aanvraag' OR NEW.is_test THEN RETURN NEW; END IF;
  UPDATE aanvraag_concepten c SET status = 'dubbel', dubbel_lead_id = NEW.id, opgevolgd_op = now(),
    opvolg_notitie = concat_ws(E'\n', nullif(c.opvolg_notitie,''), 'Automatisch afgesloten: afgeronde aanvraag ontvangen.')
  WHERE c.status = 'open' AND c.lead_id IS NULL AND c.geanonimiseerd_op IS NULL
    AND c.laatst_actief_op >= now() - interval '30 days'
    AND ((c.email IS NOT NULL AND lower(trim(c.email)) = lower(trim(NEW.email)))
      OR (nullif(regexp_replace(coalesce(c.kvk,''),'\D','','g'),'') IS NOT NULL AND regexp_replace(c.kvk,'\D','','g') = regexp_replace(coalesce(NEW.kvk_nummer,''),'\D','','g')));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sluit_dubbele_concepten() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sluit_dubbele_concepten ON public.leads;
CREATE TRIGGER trg_sluit_dubbele_concepten AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.sluit_dubbele_concepten();