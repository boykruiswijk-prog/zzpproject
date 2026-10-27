CREATE TABLE public.openai_ads_conversie_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 aanvraag_id uuid REFERENCES public.leads(id),
 event_id text NOT NULL UNIQUE,
 validate_only boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK (status IN ('bezig','verzonden','gevalideerd','fout','onzeker')),
 http_code integer CHECK (http_code BETWEEN 100 AND 599),
 fout text,
 aangemaakt_op timestamptz NOT NULL DEFAULT now(),
 bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
 CHECK (validate_only OR aanvraag_id IS NOT NULL)
);
GRANT ALL ON public.openai_ads_conversie_log TO service_role;
ALTER TABLE public.openai_ads_conversie_log ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.openai_ads_conversie_log IS 'Service-only OpenAI Ads delivery evidence, no customer fields or raw provider response. Unique event_id is the durable dispatch claim; uncertain deliveries are not retried automatically.';