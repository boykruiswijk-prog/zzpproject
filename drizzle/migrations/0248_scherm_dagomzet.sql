-- A8-aanvulling Dagomzet: aanvragen van vandaag (Amsterdam) volgens tel_aanvraag_cohort, alleen pakket + tarief.
CREATE OR REPLACE FUNCTION public.scherm_dagomzet_rijen()
RETURNS TABLE(pakket text, tarief_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(l.gekozen_pakket, b.pakket, '') AS pakket,
         coalesce(l.tarief_type, b.tarief_type, 'standaard') AS tarief_type
  FROM public.tel_aanvraag_cohort() c
  LEFT JOIN public.leads l ON l.id = c.sleutel
  LEFT JOIN LATERAL (SELECT b.pakket, b.tarief_type FROM public.bav_aanmeldingen b
                     WHERE b.lead_id = c.sleutel OR b.id = c.sleutel ORDER BY b.aangemeld_op LIMIT 1) b ON true
  WHERE c.dag = (now() AT TIME ZONE 'Europe/Amsterdam')::date
$$;
REVOKE ALL ON FUNCTION public.scherm_dagomzet_rijen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scherm_dagomzet_rijen() TO service_role;