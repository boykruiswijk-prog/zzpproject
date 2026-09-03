UPDATE public.articles SET category = 'Nieuws', updated_at = now()
WHERE slug IN ('zzp-er-met-een-bv-wat-zijn-de-voor-en-nadelen','voordelen-van-zzp','starten-met-ondernemen-als-zzper','sbi-codes');

UPDATE public.articles SET category = 'Fiscaal', updated_at = now()
WHERE slug = 'hoe-combineer-je-loondienst-en-zzp';

UPDATE public.articles SET category = 'Regelgeving', updated_at = now()
WHERE slug IN ('algemene-verordening-gegevensbeschermin-avg','waarom-als-zzp-er-wel-of-niet-kiezen-voor-payrolling');