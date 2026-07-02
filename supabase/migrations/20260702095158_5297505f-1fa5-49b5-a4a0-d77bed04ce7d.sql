
-- Gedeelde trigger-functie die een nieuw bronrecord koppelt aan de persoonslaag.
CREATE OR REPLACE FUNCTION public.koppel_bronrecord_aan_persoon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bron TEXT := TG_ARGV[0];             -- 'leads' | 'service' | 'screening'
  v_email TEXT;
  v_voornaam TEXT;
  v_achternaam TEXT;
  v_kvk TEXT;
  v_bedrijfsnaam TEXT;
  v_iban TEXT;
  v_n_email TEXT;
  v_n_naam TEXT;
  v_beslissing TEXT;
  v_person_id UUID;
  v_ond_id UUID;
BEGIN
  -- Velden per bron
  IF v_bron = 'leads' THEN
    v_email := NEW.email;
    v_voornaam := NEW.voornaam;
    v_achternaam := NEW.achternaam;
    v_kvk := NEW.kvk_nummer;
    v_bedrijfsnaam := NEW.bedrijfsnaam;
    v_iban := NEW.iban;
  ELSIF v_bron = 'service' THEN
    v_email := NEW.email;
    v_voornaam := NEW.voornaam;
    v_achternaam := NEW.achternaam;
    v_kvk := NULL;
    v_bedrijfsnaam := NULL;
    v_iban := NULL;
  ELSIF v_bron = 'screening' THEN
    v_email := NEW.email;
    v_voornaam := NEW.voornaam;
    v_achternaam := NEW.achternaam;
    v_kvk := NEW.kvk_nummer;
    v_bedrijfsnaam := NEW.bedrijfsnaam;
    v_iban := NULL;
  ELSE
    RETURN NEW;
  END IF;

  v_n_email := NULLIF(lower(trim(v_email)), '');

  -- Zonder email: niet automatisch koppelen (verschijnt als niet-gekoppeld in CRM).
  IF v_n_email IS NULL THEN
    RETURN NEW;
  END IF;

  v_n_naam := lower(regexp_replace(trim(coalesce(v_voornaam,'') || ' ' || coalesce(v_achternaam,'')), '\s+', ' ', 'g'));
  v_kvk := NULLIF(trim(v_kvk), '');
  v_bedrijfsnaam := NULLIF(trim(v_bedrijfsnaam), '');
  v_iban := NULLIF(trim(v_iban), '');

  SELECT beslissing INTO v_beslissing
  FROM public.crm_identiteit_beslissingen
  WHERE genormaliseerd_email = v_n_email;

  -- Bestaande persoon zoeken volgens dezelfde regels als het CRM-scherm.
  IF v_beslissing = 'splitsen' THEN
    SELECT p.id INTO v_person_id
    FROM public.personen p
    WHERE p.genormaliseerd_email = v_n_email
      AND lower(regexp_replace(trim(coalesce(p.voornaam,'') || ' ' || coalesce(p.achternaam,'')), '\s+', ' ', 'g')) = v_n_naam
    ORDER BY p.created_at ASC
    LIMIT 1;
  ELSE
    SELECT p.id INTO v_person_id
    FROM public.personen p
    WHERE p.genormaliseerd_email = v_n_email
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_person_id IS NULL THEN
    INSERT INTO public.personen(genormaliseerd_email, email_weergave, voornaam, achternaam)
    VALUES (v_n_email, v_email, NULLIF(trim(v_voornaam), ''), NULLIF(trim(v_achternaam), ''))
    RETURNING id INTO v_person_id;
  ELSE
    UPDATE public.personen
       SET voornaam = COALESCE(voornaam, NULLIF(trim(v_voornaam), '')),
           achternaam = COALESCE(achternaam, NULLIF(trim(v_achternaam), '')),
           email_weergave = COALESCE(email_weergave, v_email)
     WHERE id = v_person_id;
  END IF;

  -- Onderneming koppelen als er kvk of bedrijfsnaam is
  IF v_kvk IS NOT NULL OR v_bedrijfsnaam IS NOT NULL THEN
    v_ond_id := NULL;
    IF v_kvk IS NOT NULL THEN
      SELECT o.id INTO v_ond_id
      FROM public.ondernemingen o
      JOIN public.persoon_onderneming po ON po.onderneming_id = o.id AND po.persoon_id = v_person_id
      WHERE o.kvk = v_kvk
      LIMIT 1;
    ELSE
      SELECT o.id INTO v_ond_id
      FROM public.ondernemingen o
      JOIN public.persoon_onderneming po ON po.onderneming_id = o.id AND po.persoon_id = v_person_id
      WHERE o.kvk IS NULL AND o.naam IS NOT DISTINCT FROM v_bedrijfsnaam
      LIMIT 1;
    END IF;

    IF v_ond_id IS NULL THEN
      INSERT INTO public.ondernemingen(kvk, naam, iban)
      VALUES (v_kvk, v_bedrijfsnaam, v_iban)
      RETURNING id INTO v_ond_id;
      INSERT INTO public.persoon_onderneming(persoon_id, onderneming_id)
      VALUES (v_person_id, v_ond_id)
      ON CONFLICT (persoon_id, onderneming_id) DO NOTHING;
    ELSE
      UPDATE public.ondernemingen
         SET naam = COALESCE(naam, v_bedrijfsnaam),
             iban = COALESCE(iban, v_iban)
       WHERE id = v_ond_id;
    END IF;
  END IF;

  INSERT INTO public.persoon_bron_koppeling(persoon_id, bron_tabel, bron_id)
  VALUES (v_person_id, v_bron, NEW.id)
  ON CONFLICT (bron_tabel, bron_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_koppel_persoon
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.koppel_bronrecord_aan_persoon('leads');

CREATE TRIGGER trg_service_koppel_persoon
AFTER INSERT ON public.klant_service_aanvragen
FOR EACH ROW EXECUTE FUNCTION public.koppel_bronrecord_aan_persoon('service');

CREATE TRIGGER trg_screening_koppel_persoon
AFTER INSERT ON public.screening_aanvragen
FOR EACH ROW EXECUTE FUNCTION public.koppel_bronrecord_aan_persoon('screening');
