CREATE TABLE public.scherm_apparaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 1 AND 80),
  token_hash text UNIQUE,
  gekoppeld_door uuid,
  gekoppeld_op timestamptz NOT NULL DEFAULT now(),
  laatst_gezien_op timestamptz,
  ingetrokken_op timestamptz
);
GRANT SELECT ON public.scherm_apparaten TO authenticated;
GRANT ALL ON public.scherm_apparaten TO service_role;
ALTER TABLE public.scherm_apparaten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin leest schermapparaten" ON public.scherm_apparaten FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

CREATE TABLE public.scherm_koppelverzoeken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koppelcode text NOT NULL CHECK (koppelcode ~ '^[A-HJKMNP-Z2-9]{6}$'),
  apparaat_geheim_hash text NOT NULL,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  verloopt_op timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  goedgekeurd_op timestamptz,
  apparaat_id uuid REFERENCES public.scherm_apparaten(id)
);
CREATE INDEX scherm_koppelverzoeken_code_idx ON public.scherm_koppelverzoeken (koppelcode, verloopt_op);
GRANT SELECT ON public.scherm_koppelverzoeken TO authenticated;
GRANT ALL ON public.scherm_koppelverzoeken TO service_role;
ALTER TABLE public.scherm_koppelverzoeken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor/admin leest koppelverzoeken" ON public.scherm_koppelverzoeken FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));