// Bundelcontrole interne cyberwaarden. Regel: publieke chunks zijn alles wat vanaf
// index.html bereikbaar is via statische en dynamische imports, behalve dynamische
// imports naar src/pages/admin/** of src/components/admin/** (beheer, achter 2FA).
import fs from "fs";
import path from "path";

type Chunk = { file: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[] };
const ADMIN = /^src\/(pages|components)\/admin\//;
export const VERBODEN = ["CYBER_INTERNE_JAARLIMIET", "gedeeldJaarmaximum", "gedeelde jaarlimiet", "Interne informatie", "CYBER_INTERN", "Cyber Collectief"];
// Het bedrag is ook de openbare AVB-dekking; alleen fout in cybercontext.
const BEDRAG = /2\.500\.000|2500000|25e5|2_500_000/g;
const CYBERCONTEXT = /cyber|jaarlimiet|deelnemer|collectief/i;

export function publiekeChunks(dist: string): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, ".vite/manifest.json"), "utf8")) as Record<string, Chunk>;
  const gezien = new Set<string>();
  const stapel = Object.keys(manifest).filter((k) => manifest[k].isEntry);
  while (stapel.length) {
    const k = stapel.pop()!;
    if (gezien.has(k) || !manifest[k]) continue;
    gezien.add(k);
    stapel.push(...(manifest[k].imports ?? []), ...(manifest[k].dynamicImports ?? []).filter((d) => !ADMIN.test(d)));
  }
  return [...new Set([...gezien].map((k) => manifest[k].file).filter((f) => f.endsWith(".js")))].sort();
}

export function bundelLekken(dist: string) {
  const chunks = publiekeChunks(dist);
  const fouten: string[] = [];
  for (const file of chunks) {
    const code = fs.readFileSync(path.join(dist, file), "utf8");
    for (const v of VERBODEN) if (code.includes(v)) fouten.push(`${file}: ${v}`);
    for (const m of code.matchAll(BEDRAG)) {
      const omgeving = code.slice(Math.max(0, m.index! - 150), m.index! + 150);
      if (CYBERCONTEXT.test(omgeving)) fouten.push(`${file}: ${m[0]} in cybercontext`);
    }
  }
  return { chunks, fouten };
}