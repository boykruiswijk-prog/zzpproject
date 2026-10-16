// Bundelcontrole interne cyberwaarden. Regel: publieke chunks zijn alles wat vanaf
// index.html bereikbaar is via statische en dynamische imports, behalve dynamische
// imports naar src/pages/admin/** of src/components/admin/** (beheer, achter 2FA).
import fs from "fs";
import path from "path";

type Chunk = { file: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[] };
const ADMIN = /^src\/(pages|components)\/admin\//;
export const VERBODEN = ["CYBER_INTERNE_JAARLIMIET", "gedeeldJaarmaximum", "gedeelde jaarlimiet", "Interne informatie", "CYBER_INTERN", "Cyber Collectief"];
// Exacte bestaande AVB-uitzonderingen: object avb.perGebeurtenis, AVB-copy,
// aanbiedersvergelijking en SelectItem voor verzekerd bedrag. Geen chunk-allowlist.
const BEDRAG = /2\.500\.000|2500000|25e5|2_500_000/g;

export function onverwachteBedragen(code: string): string[] {
  const veilig = code
    .replace(/avb:\{perGebeurtenis:(?:2500000|25e5|2_500_000)/g, "avb:{perGebeurtenis:AVB")
    .replace(/AVB € 2\.500\.000/g, "AVB € AVB")
    .replace(/€ 250\.000 standaard, € 2\.500\.000 voor onder meer architecten/g, "AVB-vergelijking")
    .replace(/value:"2500000",children:"€2\.500\.000"/g, 'value:"AVB",children:"AVB"');
  return [...veilig.matchAll(BEDRAG)].map((m) => m[0]);
}

export function publiekeChunks(dist: string): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, ".vite/manifest.json"), "utf8")) as Record<string, Chunk>;
  const gezien = new Set<string>();
  const stapel = Object.keys(manifest).filter((k) => manifest[k].isEntry);
  while (stapel.length) {
    const k = stapel.pop();
    if (!k) continue;
    if (gezien.has(k) || !manifest[k]) continue;
    gezien.add(k);
    stapel.push(...(manifest[k].imports ?? []), ...(manifest[k].dynamicImports ?? []).filter((d) => !ADMIN.test(d)));
  }
  // Alleen bewijsbaar exclusieve admin-chunks overslaan. Onbekende/orphan JS ook scannen.
  const admin = new Set<string>();
  const adminStapel = Object.keys(manifest).filter((k) => ADMIN.test(k));
  while (adminStapel.length) {
    const k = adminStapel.pop();
    if (!k || admin.has(k) || !manifest[k]) continue;
    admin.add(k);
    adminStapel.push(...(manifest[k].imports ?? []), ...(manifest[k].dynamicImports ?? []));
  }
  const publiekFiles = new Set([...gezien].map((k) => manifest[k].file));
  const adminFiles = new Set([...admin].map((k) => manifest[k].file).filter((f) => !publiekFiles.has(f)));
  return fs.readdirSync(path.join(dist, "assets"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `assets/${f}`).filter((f) => !adminFiles.has(f)).sort();
}

export function bundelLekken(dist: string) {
  const chunks = publiekeChunks(dist);
  const fouten: string[] = [];
  for (const file of chunks) {
    const code = fs.readFileSync(path.join(dist, file), "utf8");
    for (const v of VERBODEN) if (code.includes(v)) fouten.push(`${file}: ${v}`);
    for (const bedrag of onverwachteBedragen(code)) fouten.push(`${file}: ${bedrag} buiten exacte AVB-uitzondering`);
  }
  return { chunks, fouten };
}