ALTER TABLE public.marketing_snapshot DROP CONSTRAINT marketing_snapshot_bron_check;

ALTER TABLE public.marketing_snapshot
  ADD CONSTRAINT marketing_snapshot_bron_check
  CHECK (bron IN ('google_ads', 'microsoft_ads', 'search_console', 'ai_zichtbaarheid', 'ga4', 'ai_team'));