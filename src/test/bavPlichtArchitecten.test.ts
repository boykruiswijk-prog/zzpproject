import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Feitcorrectie 5-11 (A16): architecten hebben geen wettelijke BAV-plicht.
const pagina = ["src/pages/BavZzp.tsx", "src/pages/Beroepsaansprakelijkheidsverzekering.tsx"];
const GOED = "Architecten hebben geen wettelijke plicht, maar hun beroepsvereniging kan het eisen.";

describe("BAV-plicht-FAQ noemt architecten niet als wettelijk verplicht", () => {
  it.each(pagina)("%s", (pad) => {
    const regel = readFileSync(pad, "utf8").split("\n").find((r) => /question: "Is een (BAV|beroepsaansprakelijkheidsverzekering) verplicht\?"/.test(r));
    expect(regel).toBeDefined();
    expect(/architecten/i.test(regel!) && /wettelijk verplicht/i.test(regel!)).toBe(false);
    expect(regel).toContain(GOED);
  });
});
