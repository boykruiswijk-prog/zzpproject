// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bundelLekken } from "../../scripts/bundleLeak";
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