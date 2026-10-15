import { EVI_PAGINA_PAD, EVI_PAGINA_PUBLIEK } from '../src/config/eviPagina';
import { writeFileSync } from 'node:fs';
// Afgeleid bestand: Edge Functions mogen niet uit src importeren.
writeFileSync('supabase/functions/_shared/eviPagina.generated.ts', `// Generated from src/config/eviPagina.ts, do not edit.\nexport const EVI_PAGINA_PUBLIEK = ${EVI_PAGINA_PUBLIEK};\nexport const EVI_PAGINA_PAD = ${JSON.stringify(EVI_PAGINA_PAD)};\n`);
