// Gebruik: bun scripts/genereer-zeker-kennis.ts
// Schrijft de kennisbasis van Zeker naar de Edge Function-map (byte-gelijk getest).
import { writeFileSync } from "node:fs";
import { bouwZekerKennis } from "../src/lib/zeker/bouwKennis";

export function renderZekerKennis(): string {
  return `// AUTOMATISCH GEGENEREERD door scripts/genereer-zeker-kennis.ts — niet handmatig wijzigen.\n` +
    `// Bron: src/data/bavPakketten.ts, faqItems.ts, documentenLijst.ts, sectorVerzekeringskaart.ts, src/config/seoRoutes.ts, nl.json.\n` +
    `export const ZEKER_KENNIS = ${JSON.stringify(bouwZekerKennis(), null, 2)} as const;\n`;
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  writeFileSync("supabase/functions/_shared/zekerKennis.generated.ts", renderZekerKennis());
  console.log("zekerKennis.generated.ts bijgewerkt");
}
