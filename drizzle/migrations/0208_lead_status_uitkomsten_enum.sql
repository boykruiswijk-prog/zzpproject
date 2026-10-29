-- A23-aanvulling 3: drie uitkomsten naast (niet in plaats van) afgerond. Bestaande records ongewijzigd.
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'klant_geworden';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'geen_interesse';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'vraag_beantwoord';