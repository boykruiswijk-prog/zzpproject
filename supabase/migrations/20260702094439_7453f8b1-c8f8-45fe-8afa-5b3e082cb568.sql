
-- 1. Nieuwe persoonslaag: additief, geen wijzigingen aan bestaande tabellen.

CREATE TABLE public.personen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genormaliseerd_email TEXT,
  email_weergave TEXT,
  voornaam TEXT,
  achternaam TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_personen_email ON public.personen(genormaliseerd_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personen TO authenticated;
GRANT ALL ON public.personen TO service_role;
ALTER TABLE public.personen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team kan personen bekijken" ON public.personen
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin kan personen invoegen" ON public.personen
FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan personen wijzigen" ON public.personen
FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan personen verwijderen" ON public.personen
FOR DELETE TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TRIGGER trg_personen_updated BEFORE UPDATE ON public.personen
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.ondernemingen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kvk TEXT,
  naam TEXT,
  rechtsvorm TEXT,
  iban TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ondernemingen_kvk ON public.ondernemingen(kvk);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ondernemingen TO authenticated;
GRANT ALL ON public.ondernemingen TO service_role;
ALTER TABLE public.ondernemingen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team kan ondernemingen bekijken" ON public.ondernemingen
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin kan ondernemingen invoegen" ON public.ondernemingen
FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan ondernemingen wijzigen" ON public.ondernemingen
FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan ondernemingen verwijderen" ON public.ondernemingen
FOR DELETE TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TRIGGER trg_ondernemingen_updated BEFORE UPDATE ON public.ondernemingen
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.persoon_onderneming (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persoon_id UUID NOT NULL REFERENCES public.personen(id) ON DELETE CASCADE,
  onderneming_id UUID NOT NULL REFERENCES public.ondernemingen(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (persoon_id, onderneming_id)
);
CREATE INDEX idx_po_persoon ON public.persoon_onderneming(persoon_id);
CREATE INDEX idx_po_onderneming ON public.persoon_onderneming(onderneming_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persoon_onderneming TO authenticated;
GRANT ALL ON public.persoon_onderneming TO service_role;
ALTER TABLE public.persoon_onderneming ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team kan persoon_onderneming bekijken" ON public.persoon_onderneming
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin kan persoon_onderneming invoegen" ON public.persoon_onderneming
FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan persoon_onderneming wijzigen" ON public.persoon_onderneming
FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan persoon_onderneming verwijderen" ON public.persoon_onderneming
FOR DELETE TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));


CREATE TABLE public.persoon_bron_koppeling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persoon_id UUID NOT NULL REFERENCES public.personen(id) ON DELETE CASCADE,
  bron_tabel TEXT NOT NULL CHECK (bron_tabel IN ('leads','service','screening')),
  bron_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bron_tabel, bron_id)
);
CREATE INDEX idx_pbk_persoon ON public.persoon_bron_koppeling(persoon_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persoon_bron_koppeling TO authenticated;
GRANT ALL ON public.persoon_bron_koppeling TO service_role;
ALTER TABLE public.persoon_bron_koppeling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team kan bron_koppeling bekijken" ON public.persoon_bron_koppeling
FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Supervisor/admin kan bron_koppeling invoegen" ON public.persoon_bron_koppeling
FOR INSERT TO authenticated WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan bron_koppeling wijzigen" ON public.persoon_bron_koppeling
FOR UPDATE TO authenticated USING (public.is_supervisor_or_admin(auth.uid())) WITH CHECK (public.is_supervisor_or_admin(auth.uid()));
CREATE POLICY "Supervisor/admin kan bron_koppeling verwijderen" ON public.persoon_bron_koppeling
FOR DELETE TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));


-- 2. Backfill vanuit bestaande records, respecteer crm_identiteit_beslissingen.
DO $$
DECLARE
  r RECORD;
  v_person_id UUID;
  v_ond_id UUID;
BEGIN
  CREATE TEMP TABLE tmp_key_person(group_key TEXT PRIMARY KEY, person_id UUID) ON COMMIT DROP;

  FOR r IN
    WITH e AS (
      SELECT 'leads'::text AS bron, id AS bron_id, voornaam, achternaam, email,
             kvk_nummer AS kvk, bedrijfsnaam, iban, created_at
      FROM public.leads
      UNION ALL
      SELECT 'service', id, voornaam, achternaam, email,
             NULL::text, NULL::text, NULL::text, created_at
      FROM public.klant_service_aanvragen
      UNION ALL
      SELECT 'screening', id, voornaam, achternaam, email,
             kvk_nummer, bedrijfsnaam, NULL::text, aangemeld_op
      FROM public.screening_aanvragen
    ),
    n AS (
      SELECT bron, bron_id,
        NULLIF(lower(trim(email)), '') AS n_email,
        email AS email_weergave,
        NULLIF(trim(voornaam), '') AS voornaam,
        NULLIF(trim(achternaam), '') AS achternaam,
        lower(regexp_replace(trim(coalesce(voornaam,'') || ' ' || coalesce(achternaam,'')), '\s+', ' ', 'g')) AS n_naam,
        NULLIF(trim(kvk), '') AS kvk,
        NULLIF(trim(bedrijfsnaam), '') AS bedrijfsnaam,
        NULLIF(trim(iban), '') AS iban,
        created_at
      FROM e
    )
    SELECT n.*, b.beslissing,
      CASE
        WHEN n.n_email IS NULL THEN 'no-email:' || n.bron || ':' || n.bron_id::text
        WHEN b.beslissing = 'splitsen' THEN n.n_email || '|' || COALESCE(NULLIF(n.n_naam,''), 'noname:' || n.bron || ':' || n.bron_id::text)
        ELSE n.n_email
      END AS group_key
    FROM n
    LEFT JOIN public.crm_identiteit_beslissingen b ON b.genormaliseerd_email = n.n_email
    ORDER BY created_at ASC NULLS LAST
  LOOP
    SELECT person_id INTO v_person_id FROM tmp_key_person WHERE group_key = r.group_key;
    IF v_person_id IS NULL THEN
      INSERT INTO public.personen(genormaliseerd_email, email_weergave, voornaam, achternaam, created_at)
      VALUES (r.n_email, r.email_weergave, r.voornaam, r.achternaam, COALESCE(r.created_at, now()))
      RETURNING id INTO v_person_id;
      INSERT INTO tmp_key_person VALUES (r.group_key, v_person_id);
    ELSE
      UPDATE public.personen
         SET voornaam = COALESCE(voornaam, r.voornaam),
             achternaam = COALESCE(achternaam, r.achternaam),
             email_weergave = COALESCE(email_weergave, r.email_weergave)
       WHERE id = v_person_id;
    END IF;

    IF r.kvk IS NOT NULL OR r.bedrijfsnaam IS NOT NULL THEN
      v_ond_id := NULL;
      IF r.kvk IS NOT NULL THEN
        SELECT o.id INTO v_ond_id
        FROM public.ondernemingen o
        JOIN public.persoon_onderneming po ON po.onderneming_id = o.id AND po.persoon_id = v_person_id
        WHERE o.kvk = r.kvk LIMIT 1;
      ELSE
        SELECT o.id INTO v_ond_id
        FROM public.ondernemingen o
        JOIN public.persoon_onderneming po ON po.onderneming_id = o.id AND po.persoon_id = v_person_id
        WHERE o.kvk IS NULL AND o.naam IS NOT DISTINCT FROM r.bedrijfsnaam LIMIT 1;
      END IF;

      IF v_ond_id IS NULL THEN
        INSERT INTO public.ondernemingen(kvk, naam, iban)
        VALUES (r.kvk, r.bedrijfsnaam, r.iban)
        RETURNING id INTO v_ond_id;
        INSERT INTO public.persoon_onderneming(persoon_id, onderneming_id)
        VALUES (v_person_id, v_ond_id);
      ELSE
        UPDATE public.ondernemingen
           SET naam = COALESCE(naam, r.bedrijfsnaam),
               iban = COALESCE(iban, r.iban)
         WHERE id = v_ond_id;
      END IF;
    END IF;

    INSERT INTO public.persoon_bron_koppeling(persoon_id, bron_tabel, bron_id)
    VALUES (v_person_id, r.bron, r.bron_id)
    ON CONFLICT (bron_tabel, bron_id) DO NOTHING;
  END LOOP;
END $$;
