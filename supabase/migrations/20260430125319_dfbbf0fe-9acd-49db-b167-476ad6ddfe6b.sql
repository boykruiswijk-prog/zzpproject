-- Create screening_aanvragen table
CREATE TABLE public.screening_aanvragen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voornaam TEXT NOT NULL,
  achternaam TEXT NOT NULL,
  email TEXT NOT NULL,
  telefoon TEXT,
  bedrijfsnaam TEXT,
  kvk_nummer TEXT,
  beroep TEXT,
  sector TEXT,
  screening_type TEXT,
  status TEXT NOT NULL DEFAULT 'nieuw',
  otentica_flow_id TEXT,
  otentica_status TEXT NOT NULL DEFAULT 'wachtend',
  otentica_rapport_url TEXT,
  otentica_webhook_data JSONB,
  notities TEXT,
  aangemeld_op TIMESTAMPTZ NOT NULL DEFAULT now(),
  bijgewerkt_op TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers (avoid CHECK constraints with mutable logic)
CREATE OR REPLACE FUNCTION public.validate_screening_aanvraag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.screening_type IS NOT NULL AND NEW.screening_type NOT IN ('basis','uitgebreid','compleet') THEN
    RAISE EXCEPTION 'Ongeldig screening_type: %', NEW.screening_type;
  END IF;
  IF NEW.status NOT IN ('nieuw','verzonden','in_behandeling','afgerond','afgewezen') THEN
    RAISE EXCEPTION 'Ongeldige status: %', NEW.status;
  END IF;
  IF NEW.otentica_status NOT IN ('wachtend','uitgenodigd','in_behandeling','goedgekeurd','afgekeurd','verlopen') THEN
    RAISE EXCEPTION 'Ongeldige otentica_status: %', NEW.otentica_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_screening_aanvraag
BEFORE INSERT OR UPDATE ON public.screening_aanvragen
FOR EACH ROW EXECUTE FUNCTION public.validate_screening_aanvraag();

CREATE TRIGGER trg_screening_aanvragen_bijgewerkt_op
BEFORE UPDATE ON public.screening_aanvragen
FOR EACH ROW EXECUTE FUNCTION public.update_bijgewerkt_op_column();

ALTER TABLE public.screening_aanvragen ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a screening request (public form)
CREATE POLICY "Anyone can submit a screening aanvraag"
ON public.screening_aanvragen
FOR INSERT
TO public
WITH CHECK (true);

-- Team members can view
CREATE POLICY "Team members can view screening aanvragen"
ON public.screening_aanvragen
FOR SELECT
TO authenticated
USING (is_team_member(auth.uid()));

-- Team members can update
CREATE POLICY "Team members can update screening aanvragen"
ON public.screening_aanvragen
FOR UPDATE
TO authenticated
USING (is_team_member(auth.uid()));

-- Admins can delete
CREATE POLICY "Admins can delete screening aanvragen"
ON public.screening_aanvragen
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));