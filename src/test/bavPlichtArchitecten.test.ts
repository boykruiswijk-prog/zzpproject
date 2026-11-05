import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Feitcorrectie 5-11 (A16): architecten hebben geen wettelijke BAV-plicht.
const pagina = ["src/pages/BavZzp.tsx", "src/pages/Beroepsaansprakelijkheidsverzekering.tsx"];
const GOED = "Architecten hebben geen wettelijke plicht, maar hun beroepsvereniging kan het eisen.";

describe("BAV-plicht-FAQ noemt architecten niet als wettelijk verplicht", () => {
  it.each(pagina)("%s", (pad) => {
    const regels = readFileSync(pad, "utf8").split("\n").filter((r) => /question: "Is een (BAV|beroepsaansprakelijkheidsverzekering) verplicht\?"/.test(r));
    expect(regels.length).toBeGreaterThan(0);
    for (const r of regels) expect(/architecten/i.test(r) && /wettelijk verplicht/i.test(r)).toBe(false);
    expect(regels.some((r) => r.includes(GOED))).toBe(true);
  });
});
