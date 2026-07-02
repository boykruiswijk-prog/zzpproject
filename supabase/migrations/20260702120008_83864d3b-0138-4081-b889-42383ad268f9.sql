
CREATE OR REPLACE FUNCTION public.log_lead_binnengekomen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_naam text; v_bron text;
BEGIN
  BEGIN
    v_naam := trim(coalesce(NEW.voornaam,'') || ' ' || coalesce(NEW.achternaam,''));
    IF v_naam = '' THEN v_naam := coalesce(NEW.email, 'onbekende aanvrager'); END IF;
    v_bron := coalesce(NEW.type::text, 'aanvraag');
    INSERT INTO public.activiteiten_log(actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, klant_email)
    VALUES ('lead_binnengekomen','Nieuwe lead binnengekomen: '||v_naam||' ('||v_bron||')', NULL, 'Aanmelding via website', NEW.id, lower(trim(coalesce(NEW.email,''))));
  EXCEPTION WHEN OTHERS THEN
    -- Loggen mag het aanmaken van de lead nooit blokkeren.
    NULL;
  END;
  RETURN NEW;
END $$;
