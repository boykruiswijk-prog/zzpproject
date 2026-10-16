// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bundelLekken, onverwachteBedragen, publiekeChunks, VERBODEN } from "../../scripts/bundleLeak";
import os from "node:os";
import * as cyber from "../../supabase/functions/_shared/cyber";

const root = path.resolve(__dirname, "../..");
const dist = path.join(root, "dist");
function bestanden(map: string): string[] {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(map, e.name);
    return e.isDirectory() ? bestanden(p) : /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

describe("interne cyberwaarden", () => {
  it("onderscheidt exacte bestaande AVB-waarden van cyberwaarden", () => {
    expect(onverwachteBedragen('avb:{perGebeurtenis:25e5,perJaar:5e6};"AVB € 2.500.000";{value:"2500000",children:"€2.500.000"}')).toEqual([]);
    expect(onverwachteBedragen('cyber:{maximum:2500000}')).toEqual(["2500000"]);
  });

  it("scant publieke, gedeelde en onbekende chunks, nooit exclusieve admin-chunks", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-bundle-"));
    try {
      fs.mkdirSync(path.join(fixture, ".vite")); fs.mkdirSync(path.join(fixture, "assets"));
      const manifest = {
        "index.html": { file: "assets/index.js", isEntry: true, dynamicImports: ["src/pages/Index.tsx", "src/pages/admin/LeadDetail.tsx"] },
        "src/pages/Index.tsx": { file: "assets/public.js", imports: ["_shared.js"] },
        "src/pages/admin/LeadDetail.tsx": { file: "assets/admin.js", imports: ["_shared.js", "_intern.js"] },
        "_shared.js": { file: "assets/shared.js" }, "_intern.js": { file: "assets/intern.js" },
      };
      fs.writeFileSync(path.join(fixture, ".vite/manifest.json"), JSON.stringify(manifest));
      for (const f of ["index", "public", "admin", "shared", "intern", "orphan"]) fs.writeFileSync(path.join(fixture, `assets/${f}.js`), "");
      fs.writeFileSync(path.join(fixture, "assets/intern.js"), VERBODEN.join(" "));
      expect(publiekeChunks(fixture)).toEqual(["assets/index.js", "assets/orphan.js", "assets/public.js", "assets/shared.js"]);
      expect(bundelLekken(fixture).fouten).toEqual([]);
      for (const waarde of [...VERBODEN, "2.500.000", "2500000"]) {
        fs.writeFileSync(path.join(fixture, "assets/shared.js"), waarde);
        expect(bundelLekken(fixture).fouten.length).toBeGreaterThan(0);
      }
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
  });
  it("publieke cyberbron bevat geen interne waarden", () => {
    expect(Object.keys(cyber)).not.toContain("CYBER_INTERNE_JAARLIMIET");
    expect(cyber.CYBER).not.toHaveProperty("gedeeldJaarmaximum");
  });

  it("alleen admin en edge functions importeren cyberIntern", () => {
    const publiek = [...bestanden(path.join(root, "src")), ...bestanden(path.join(root, "supabase/functions/_shared"))]
      .map((p) => path.relative(root, p).replace(/\\/g, "/"))
      .filter((p) => !/^src\/(pages|components)\/admin\//.test(p) && !/^src\/test\//.test(p) && p !== "supabase/functions/_shared/cyberIntern.ts");
    const fouten = publiek.filter((p) => /cyberIntern/.test(fs.readFileSync(path.join(root, p), "utf8")));
    expect(fouten).toEqual([]);
  });

  it.skipIf(!fs.existsSync(path.join(dist, ".vite/manifest.json")))("publieke productiechunks bevatten geen interne waarden", () => {
    const { chunks, fouten } = bundelLekken(dist);
    expect(chunks.length).toBeGreaterThan(10);
    expect(fouten).toEqual([]);
  });
});