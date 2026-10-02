ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'geldig',
  ADD COLUMN IF NOT EXISTS versie integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ingetrokken_op timestamptz,
  ADD COLUMN IF NOT EXISTS ingetrokken_door uuid,
  ADD COLUMN IF NOT EXISTS intrek_reden text;

ALTER TABLE public.policies ADD CONSTRAINT policies_status_check CHECK (status IN ('geldig','ingetrokken'));

CREATE TABLE public.policy_versies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE RESTRICT,
  certificate_number text NOT NULL,
  versie integer NOT NULL,
  actie text NOT NULL CHECK (actie IN ('aangepast','ingetrokken','gemaild')),
  oude_waarden jsonb NOT NULL,
  nieuwe_waarden jsonb,
  oude_pdf_pad text,
  reden text,
  uitgevoerd_door uuid,
  uitgevoerd_door_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.policy_versies TO authenticated;
GRANT ALL ON public.policy_versies TO service_role;
ALTER TABLE public.policy_versies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team kan certificaatversies lezen" ON public.policy_versies
  FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_policy_versies_onveranderbaar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Certificaatversies zijn onveranderbaar';
END $$;
CREATE TRIGGER trg_policy_versies_onveranderbaar BEFORE UPDATE OR DELETE ON public.policy_versies
  FOR EACH ROW EXECUTE FUNCTION public.guard_policy_versies_onveranderbaar();

CREATE OR REPLACE FUNCTION public.guard_policy_nummer_en_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.certificate_number IS DISTINCT FROM OLD.certificate_number AND coalesce(OLD.certificate_number,'') <> '' THEN
    RAISE EXCEPTION 'Een certificaatnummer kan nooit gewijzigd worden';
  END IF;
  IF OLD.status = 'ingetrokken' AND NEW.status IS DISTINCT FROM 'ingetrokken' THEN
    RAISE EXCEPTION 'Een ingetrokken certificaat kan niet opnieuw geldig worden';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_policy_nummer_en_status BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_policy_nummer_en_status();

DROP POLICY IF EXISTS "Customers can view their own policies" ON public.policies;
CREATE POLICY "Customers can view their own policies" ON public.policies
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND status = 'geldig');