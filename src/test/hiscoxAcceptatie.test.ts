import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Register F1-aanvulling 2 (27-10): ZP Zaken (Ellen Baars) beoordeelt de acceptatie, niet Hiscox.
const schrijftAcceptatieAanHiscoxToe = (tekst: string) =>
  tekst.split(/[.!?;\n]/).some((zin) => /hiscox/i.test(zin) && /(accept|beoordeel|beslis)/i.test(zin));

function bestanden(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return bestanden(p);
    return /\.(tsx?|md|txt|html|json)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

// Interne regels over handmatige acceptatie buiten de "Hiscox-propositie" schrijven acceptatie niet aan Hiscox toe.
const UITZONDERING = /Hiscox-propositie/;

describe("acceptatie nooit door Hiscox", () => {
  it("herkent foute en goede zinnen", () => {
    expect(schrijftAcceptatieAanHiscoxToe("Acceptatie gebeurt door Hiscox.")).toBe(true);
    expect(schrijftAcceptatieAanHiscoxToe("Hiscox beslist over de acceptatie; rest")).toBe(true);
    expect(schrijftAcceptatieAanHiscoxToe("Hiscox beoordeelt of je de cyberdekking kunt krijgen.")).toBe(true);
    expect(schrijftAcceptatieAanHiscoxToe("De verzekering loopt via Hiscox. ZP Zaken beoordeelt je aanvraag.")).toBe(false);
  });

  it("site, functions en publieke bestanden bevatten geen acceptatie door Hiscox", () => {
    const fout = ["src", "public", "supabase/functions"].flatMap(bestanden).filter((p) => {
      const regels = readFileSync(p, "utf8").split("\n").filter((r) => !UITZONDERING.test(r));
      return schrijftAcceptatieAanHiscoxToe(regels.join("\n"));
    });
    expect(fout).toEqual([]);
  });
});
