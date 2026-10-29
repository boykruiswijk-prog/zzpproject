CREATE OR REPLACE FUNCTION public.guard_a19_koppeling() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE oud_status text := to_jsonb(OLD)->>'status'; nieuw_status text := to_jsonb(NEW)->>'status';
BEGIN
 IF coalesce(current_setting('zp.a19_rpc',true),'') <> '1' AND (
  NEW.gekoppeld_onderneming_id IS DISTINCT FROM OLD.gekoppeld_onderneming_id
  OR NEW.gekoppeld_persoon_id IS DISTINCT FROM OLD.gekoppeld_persoon_id
  OR (TG_TABLE_NAME='leads' AND to_jsonb(OLD)->>'type'<>'verzekering_aanvraag' AND OLD.gekoppeld_onderneming_id IS NOT NULL AND (
   NEW.converted_at IS DISTINCT FROM OLD.converted_at
   OR (nieuw_status IS DISTINCT FROM oud_status AND NOT (
    nieuw_status IN ('klant_geworden','geen_interesse','vraag_beantwoord')
    OR (oud_status IN ('afgerond','klant_geworden','geen_interesse','vraag_beantwoord') AND nieuw_status IN ('nieuw','in_behandeling','offerte_verstuurd'))
   ))
  ))
 ) THEN RAISE EXCEPTION 'Klantkoppeling alleen wijzigen via Koppel aan klant'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_a19_koppeling() FROM PUBLIC, anon, authenticated;