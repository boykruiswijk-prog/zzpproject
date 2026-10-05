CREATE TABLE public.articles_backup_20261005 (LIKE public.articles INCLUDING ALL);
GRANT ALL ON public.articles_backup_20261005 TO service_role;
REVOKE ALL ON public.articles_backup_20261005 FROM anon, authenticated;
ALTER TABLE public.articles_backup_20261005 ENABLE ROW LEVEL SECURITY;
INSERT INTO public.articles_backup_20261005
SELECT *
FROM public.articles
WHERE slug IN (
  'wat-kosten-verzekeringen-voor-zzp-ers',
  'zzp-verzekering-kosten-2026',
  'zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb',
  'vbar-zzp-verzekering-gevolgen',
  'bijdrage-zorgverzekeringswet-zzp'
);