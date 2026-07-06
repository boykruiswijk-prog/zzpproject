
-- 1. is_test kolommen
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2. KPI-view: actieve leads (status IN actief/klant, niet test) + genormaliseerd betaalritme
CREATE OR REPLACE VIEW public.kpi_actieve_leads
WITH (security_invoker = on) AS
SELECT
  l.id,
  l.voornaam,
  l.achternaam,
  l.email,
  l.bedrijfsnaam,
  l.status,
  l.gekozen_pakket,
  l.omzet,
  l.exact_invoice_amount,
  l.geactiveerd_op,
  l.created_at,
  l.is_test,
  CASE
    WHEN lower(coalesce(l.gekozen_pakket, '')) IN ('maandelijks','jaarlijks')
      THEN lower(l.gekozen_pakket)
    WHEN lower(coalesce(l.omzet, '')) IN ('maandelijks','jaarlijks')
      THEN lower(l.omzet)
    ELSE 'onbekend'
  END AS betaalritme
FROM public.leads l
WHERE l.status IN ('actief'::lead_status, 'klant'::lead_status)
  AND l.is_test = false;

GRANT SELECT ON public.kpi_actieve_leads TO authenticated;
GRANT SELECT ON public.kpi_actieve_leads TO service_role;
