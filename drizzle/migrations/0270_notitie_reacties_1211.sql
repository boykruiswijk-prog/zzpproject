-- Reacties op notities (besluit Boy 12-11-2026, wens Ellen). Reactie = notitie met parent_id, één niveau diep.
ALTER TABLE public.crm_notities ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.crm_notities(id);
CREATE INDEX IF NOT EXISTS crm_notities_parent_id_idx ON public.crm_notities(parent_id);

ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.lead_notes(id);
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS ingetrokken_op timestamptz NULL;
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS ingetrokken_door uuid NULL;
ALTER TABLE public.lead_notes ADD COLUMN IF NOT EXISTS intrek_reden text NULL;
CREATE INDEX IF NOT EXISTS lead_notes_parent_id_idx ON public.lead_notes(parent_id);

-- Eén niveau: reactie op reactie hangt aan dezelfde hoofdnotitie; reactie hoort bij dezelfde klant/lead.
CREATE OR REPLACE FUNCTION public.crm_notitie_reactie_normaliseer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.crm_notities;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO w FROM public.crm_notities WHERE id = NEW.parent_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'hoofdnotitie niet gevonden'; END IF;
  IF w.parent_id IS NOT NULL THEN SELECT * INTO w FROM public.crm_notities WHERE id = w.parent_id; END IF;
  NEW.parent_id := w.id;
  NEW.onderneming_id := w.onderneming_id;
  NEW.persoon_id := w.persoon_id;
  NEW.is_test := w.is_test OR NEW.is_test;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_notitie_reactie_normaliseer ON public.crm_notities;
CREATE TRIGGER crm_notitie_reactie_normaliseer BEFORE INSERT ON public.crm_notities
  FOR EACH ROW EXECUTE FUNCTION public.crm_notitie_reactie_normaliseer();

-- parent_id is na aanmaken onveranderbaar.
CREATE OR REPLACE FUNCTION public.crm_notitie_parent_vast()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN RAISE EXCEPTION 'reactiekoppeling is onveranderbaar'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_notitie_parent_vast ON public.crm_notities;
CREATE TRIGGER crm_notitie_parent_vast BEFORE UPDATE ON public.crm_notities
  FOR EACH ROW EXECUTE FUNCTION public.crm_notitie_parent_vast();

CREATE OR REPLACE FUNCTION public.crm_reactie_toevoegen(_parent_id uuid, _tekst text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_naam text; w public.crm_notities;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_tekst,''))) = 0 THEN RAISE EXCEPTION 'tekst is verplicht'; END IF;
  SELECT * INTO w FROM public.crm_notities WHERE id = _parent_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'hoofdnotitie niet gevonden'; END IF;
  SELECT coalesce(nullif(full_name,''), 'teamlid') INTO v_naam FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details, parent_id)
  VALUES (w.onderneming_id, w.persoon_id, 'notitie', btrim(_tekst), auth.uid(), v_naam, w.is_test, '{}'::jsonb, _parent_id)
  RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('crm_notities', v_id, 'reactie_toegevoegd', 'parent_id', _parent_id::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id', w.onderneming_id, 'persoon_id', w.persoon_id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_reactie_toevoegen(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_reactie_toevoegen(uuid, text) TO authenticated;

-- Leadnotities: zelfde regel. Reacties onveranderbaar, niet te verwijderen, alleen intrekken met reden.
CREATE OR REPLACE FUNCTION public.lead_note_reactie_normaliseer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.lead_notes;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO w FROM public.lead_notes WHERE id = NEW.parent_id;
  IF w.id IS NULL THEN RAISE EXCEPTION 'hoofdnotitie niet gevonden'; END IF;
  IF w.parent_id IS NOT NULL THEN SELECT * INTO w FROM public.lead_notes WHERE id = w.parent_id; END IF;
  NEW.parent_id := w.id;
  NEW.lead_id := w.lead_id;
  NEW.ingetrokken_op := NULL; NEW.ingetrokken_door := NULL; NEW.intrek_reden := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lead_note_reactie_normaliseer ON public.lead_notes;
CREATE TRIGGER lead_note_reactie_normaliseer BEFORE INSERT ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.lead_note_reactie_normaliseer();

CREATE OR REPLACE FUNCTION public.lead_note_reactie_bewaken()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL OR OLD.ingetrokken_op IS NOT NULL THEN RAISE EXCEPTION 'reacties worden niet verwijderd; trek ze in met een reden'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN RAISE EXCEPTION 'reactiekoppeling is onveranderbaar'; END IF;
  IF current_setting('app.lead_note_intrekken', true) IS DISTINCT FROM 'on'
     AND (NEW.ingetrokken_op IS DISTINCT FROM OLD.ingetrokken_op OR NEW.ingetrokken_door IS DISTINCT FROM OLD.ingetrokken_door OR NEW.intrek_reden IS DISTINCT FROM OLD.intrek_reden) THEN
    RAISE EXCEPTION 'intrekken alleen via lead_notitie_intrekken';
  END IF;
  IF OLD.parent_id IS NOT NULL AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.type IS DISTINCT FROM OLD.type OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'reacties zijn onveranderbaar';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lead_note_reactie_bewaken ON public.lead_notes;
CREATE TRIGGER lead_note_reactie_bewaken BEFORE UPDATE OR DELETE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.lead_note_reactie_bewaken();

CREATE OR REPLACE FUNCTION public.lead_notitie_intrekken(_id uuid, _reden text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.lead_notes;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO n FROM public.lead_notes WHERE id = _id FOR UPDATE;
  IF n.id IS NULL THEN RAISE EXCEPTION 'notitie niet gevonden'; END IF;
  IF n.ingetrokken_op IS NOT NULL THEN RAISE EXCEPTION 'notitie is al ingetrokken'; END IF;
  IF n.user_id <> auth.uid() AND NOT public.is_supervisor_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'alleen de schrijver of supervisor/admin kan intrekken';
  END IF;
  IF length(btrim(coalesce(_reden,''))) < 3 THEN RAISE EXCEPTION 'geef een reden op'; END IF;
  PERFORM set_config('app.lead_note_intrekken', 'on', true);
  UPDATE public.lead_notes SET ingetrokken_op = now(), ingetrokken_door = auth.uid(), intrek_reden = btrim(_reden) WHERE id = _id;
  PERFORM set_config('app.lead_note_intrekken', 'off', true);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('lead_notes', _id, 'notitie_ingetrokken', 'ingetrokken_op', now()::text, auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('reden', _reden));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lead_notitie_intrekken(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_notitie_intrekken(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_notitie_reactie_normaliseer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_note_reactie_normaliseer() FROM PUBLIC, anon, authenticated;