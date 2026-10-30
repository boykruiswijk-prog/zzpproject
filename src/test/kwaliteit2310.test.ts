// @vitest-environment node
// Kwaliteitscontrole 23-10-2026 (register D6): ZP Zaken geeft geen advies en
// kiest geen dekking voor de klant. Deze zinnen mogen nergens meer voorkomen.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  legacyRedirects,
  zoekLegacyDoel,
  taalprefixRedirects,
} from "@/config/legacyRedirects";

const VERBODEN = [
  "Wij regelen de juiste dekking",
  "Wij kijken gratis mee",
  "bepalen samen welke dekking",
  "is een AVB aan te raden",
  "zorgt voor de juiste dekking",
  "Verzekering voor adviseurs",
];

function bestanden(dir: string, ext: RegExp): string[] {
  const uit: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const vol = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "node_modules") continue;
      uit.push(...bestanden(vol, ext));
    } else if (ext.test(entry.name)) {
      uit.push(vol);
    }
  }
  return uit;
}

describe("Kwaliteitscontrole 23-10-2026", () => {
  it("verboden advieszinnen komen niet voor in src, llms en Zeker-kennis", () => {
    const bronnen = [
      ...bestanden(path.resolve(__dirname, "../pages"), /\.tsx?$/),
      ...bestanden(path.resolve(__dirname, "../components"), /\.tsx?$/),
      ...bestanden(path.resolve(__dirname, "../config"), /\.ts$/),
      path.resolve(__dirname, "../../public/llms.txt"),
      path.resolve(__dirname, "../../public/llms-full.txt"),
      path.resolve(__dirname, "../../supabase/functions/_shared/zekerKennis.generated.ts"),
    ];
    for (const bestand of bronnen) {
      const tekst = fs.readFileSync(bestand, "utf8");
      for (const zin of VERBODEN) {
        expect(tekst.includes(zin), `${bestand} bevat verboden zin: "${zin}"`).toBe(false);
      }
    }
  });

  it("nieuwe 301's: nieuws-artikel en kerstacties", () => {
    const zoek = (from: string) => legacyRedirects.find((r) => r.from === from)?.to;
    expect(zoek("nieuws/is-beroeps-en-bedrijfsaansprakelijkheid-modeverschijnsel-noodzakelijk-kwaad")).toBe("/kennisbank/verschil-bav-avb-zzp");
    expect(zoek("kerstactienieuw")).toBe("/verzekeringen");
    expect(zoek("kerstactiemember")).toBe("/verzekeringen");
  });

  it("taalprefix /en, /de en /fr erft de Nederlandse doorverwijzing", () => {
    expect(zoekLegacyDoel("/en/kerstactienieuw")).toBe("/verzekeringen");
    expect(zoekLegacyDoel("/de/kerstactiemember/")).toBe("/verzekeringen");
    expect(zoekLegacyDoel("/fr/nieuws/is-beroeps-en-bedrijfsaansprakelijkheid-modeverschijnsel-noodzakelijk-kwaad")).toBe("/kennisbank/verschil-bav-avb-zzp");
    const afgeleid = taalprefixRedirects();
    const vanaf = (from: string) => afgeleid.find((r) => r.from === from)?.to;
    expect(vanaf("en/kerstactienieuw")).toBe("/verzekeringen");
    expect(vanaf("de/kerstactienieuw")).toBe("/verzekeringen");
    expect(vanaf("fr/kerstactienieuw")).toBe("/verzekeringen");
    // Bestaande bronnen blijven uniek. Alleen de expliciete 30-10-nieuwsvangregel erft taalprefixen.
    expect(afgeleid.some((r) => r.from === "en/feed-2")).toBe(false);
    expect(afgeleid.filter((r) => r.from.includes("*")).map(r => r.from)).toEqual([
      "en/home/nieuws/*", "de/home/nieuws/*", "fr/home/nieuws/*",
    ]);
    // /tv krijgt nooit een doorverwijzing.
    expect(zoekLegacyDoel("/tv")).toBeNull();
    expect(zoekLegacyDoel("/en/tv")).toBeNull();
  });
});
