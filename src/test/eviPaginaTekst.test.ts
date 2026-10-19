// @vitest-environment node
import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
import { EVI_SEO,EVI_FAQ,eviSchemas,EVI_KORT } from '../data/eviPensioen';
const pagina=fs.readFileSync('src/pages/PensioenOpbouwenZzp.tsx','utf8');
describe('Evi inhoud',()=>{
 it('SEO en schema zonder verboden termen of em dash',()=>{const tekst=JSON.stringify([EVI_SEO,EVI_FAQ,eviSchemas(),EVI_KORT]);expect(tekst).not.toMatch(/advies|adviseur|adviseren|\bbeste\b|goedkoopste|goedkoper|per gebeurtenis|direct gedekt|afsluiten|sluit af|korting|—/i);expect(tekst.replace(/geen garantie/g,'')).not.toMatch(/garantie/);expect(pagina).not.toMatch(/advies|adviseur|adviseren|\bbeste\b|goedkoopste|goedkoper|per gebeurtenis|direct gedekt|afsluiten|sluit af|korting|—/i);});
 it('risico hero en juridisch, plus disclaimer',()=>{expect(pagina.match(/EVI_RISICO/g)?.length).toBeGreaterThanOrEqual(3);});
 it('vier valide schemas en exact tien FAQ’s',()=>{const schemas=JSON.parse(JSON.stringify(eviSchemas()));expect(schemas.map((s:any)=>s['@type'])).toEqual(['BreadcrumbList','Service','FinancialProduct','FAQPage']);expect(schemas[3].mainEntity).toHaveLength(10);for(const s of schemas)expect(JSON.stringify(s)).not.toMatch(/:""/);expect(schemas[0].itemListElement.every((i:any)=>i.item.startsWith('https://zpzaken.nl/'))).toBe(true);});
 it('geen zware of externe beelden in nieuwe pagina',()=>{expect(pagina).not.toMatch(/framer-motion|three|\.jpg|\.webp/);expect(pagina).toContain('JaarruimteHero');expect(pagina).toContain('SITE_CONFIG.phone');});
});
