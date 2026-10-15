import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
import { EVI_PAGINA_PAD as pad,EVI_PAGINA_PUBLIEK,eviPaginaVindbaar,eviPaginaRobots,eviPaginaLinks } from '../config/eviPagina';
import { seoRoutes } from '../config/seoRoutes';
import { buildLlmsTxt,buildLlmsFullTxt } from '../../scripts/llmsTxt';
import { bouwZekerKennis } from '../lib/zeker/bouwKennis';
import { searchIndex } from '../data/searchIndex';
import { interneBronUitZoek,eviLeadLabel } from '../lib/interneBron';
const lees=(p:string)=>fs.readFileSync(p,'utf8');
describe('F7 enkele vlag',()=>{
 it('staat uit maar route blijft in prerenderregistry',()=>{expect(EVI_PAGINA_PUBLIEK).toBe(false);expect(seoRoutes.some(r=>r.path===pad)).toBe(true);expect(lees('src/App.tsx')).toContain('path={EVI_PAGINA_PAD}');expect(lees('scripts/prerender.ts')).toContain('if (route.path === EVI_PAGINA_PAD)');});
 for(const publiek of [false,true]) it(`vindbaarheid ${publiek}`,()=>{const routes=seoRoutes.filter(r=>eviPaginaVindbaar(r.path,publiek));expect(routes.some(r=>r.path===pad)).toBe(publiek);expect(buildLlmsTxt(seoRoutes,[],publiek).includes(pad)).toBe(publiek);expect(buildLlmsFullTxt(seoRoutes,[],publiek).includes(pad)).toBe(publiek);expect(eviPaginaLinks(publiek).some(l=>l.href===pad)).toBe(publiek);expect(eviPaginaRobots(publiek)).toBe(publiek?'index,follow':'noindex,nofollow');});
 it('geen zoek-, Zeker- of statische discovery entry',()=>{expect(searchIndex.some(r=>r.path===pad)).toBe(false);expect(bouwZekerKennis().paginas.some(r=>r.path===pad)).toBe(false);for(const p of ['public/sitemap.xml','public/llms.txt','public/llms-full.txt'])expect(lees(p)).not.toContain(pad);expect(lees('src/pages/Pensioen.tsx')).not.toContain(pad);});
 it('menu/footer en pensioenlink volgen vlag',()=>{for(const p of ['Header','Footer'])expect(lees(`src/components/layout/${p}.tsx`)).toContain('...eviPaginaLinks()');expect(lees('src/App.tsx')).toContain('EVI_PAGINA_PUBLIEK &&');expect(lees('scripts/prerender.ts')).toContain('eviPaginaVindbaar(r.path)');expect(lees('supabase/functions/sitemap/index.ts')).toContain('EVI_PAGINA_PUBLIEK ?');});
 it('app/prerender dezelfde robots en eigen canonical',()=>{expect(lees('src/pages/PensioenOpbouwenZzp.tsx')).toContain('robots={eviPaginaRobots()}');expect(lees('scripts/prerender.ts')).toContain('content="${eviPaginaRobots()}"');});
 it('bron staat los van Ads, contactlabel intern',()=>{expect(interneBronUitZoek('?bron=evi-pagina&utm_source=google')).toBe('evi-pagina');expect(interneBronUitZoek('?bron=onbekend')).toBe(null);expect(eviLeadLabel({formulier_naam:'Interesse pensioen via Evi'})).toBe('Pensioen via Evi');expect(eviLeadLabel({})).toBe(null);});
});
