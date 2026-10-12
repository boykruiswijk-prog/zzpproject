// @vitest-environment node
// Samengevoegde kennisbankartikelen (12-10-2026): elke bron heeft een directe 301
// naar het doel, er zijn geen ketens en niets in de code linkt nog naar een bron.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { legacyRedirects } from "@/config/legacyRedirects";

const SAMENGEVOEGD: Record<string, string> = {
  "zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb": "bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt",
  "vbar-zzp-verzekering-gevolgen": "vbar-wet-verduidelijking-arbeidsrelaties",
  "boekhouding-zzp": "zzp-administratie-en-boekhouding",
  "starten-als-zzper-welke-verzekeringen": "welke-verzekeringen-zzp",
};
const root = path.resolve(__dirname, "../..");

function bestanden(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? bestanden(p) : /\.(tsx?|json|txt|md|html)$/.test(e.name) ? [p] : [];
  });
}

describe("kennisbank samenvoeging", () => {
  for (const [bron, doel] of Object.entries(SAMENGEVOEGD)) {
    it(`${bron} wijst direct naar ${doel}`, () => {
      for (const from of [`kennisbank/${bron}`, bron, `blog/${bron}`]) {
        expect(legacyRedirects.find((r) => r.from === from)?.to).toBe(`/kennisbank/${doel}`);
      }
    });
  }

  it("geen redirect wijst naar een bron (geen ketens)", () => {
    const bronPaden = Object.keys(SAMENGEVOEGD).map((b) => `/kennisbank/${b}`);
    expect(legacyRedirects.filter((r) => bronPaden.includes(r.to))).toEqual([]);
  });

  it("geen links naar bron-slugs in src en public (buiten de redirectlijst)", () => {
    const re = new RegExp(Object.keys(SAMENGEVOEGD).map((s) => `kennisbank/${s}\\b`).join("|"));
    const treffers = [...bestanden(path.join(root, "src")), ...bestanden(path.join(root, "public"))]
      .filter((f) => !f.endsWith("legacyRedirects.ts") && !f.endsWith("kennisbankSamenvoeging.test.ts"))
      .filter((f) => re.test(fs.readFileSync(f, "utf8")));
    expect(treffers).toEqual([]);
  });
});
