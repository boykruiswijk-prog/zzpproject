import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STARTER } from "@/lib/starterTarief";

// Register A25 punt 4 (6-11-2026): starterstarief zichtbaar in de hero van /starters,
// opgebouwd uit de prijsbron src/lib/starterTarief.ts (geen losse hardcoded afwijking).

const bron = readFileSync("src/pages/Starters.tsx", "utf8");

describe("Starters hero: starterstarief (A25)", () => {
  it("toont het tariefblok in de hero via heroExtra", () => {
    expect(bron).toContain('data-testid="startertarief-hero"');
    expect(bron).toContain("heroExtra={");
  });

  it("gebruikt de prijsbron, geen losse bedragen", () => {
    const blok = bron.slice(bron.indexOf('data-testid="startertarief-hero"'), bron.indexOf("benefits={"));
    expect(blok).toContain("STARTER.maandprijs");
    expect(blok).toContain("STARTER.naMaandprijs");
    expect(blok).toContain("STARTER.duurMaanden");
    expect(blok).not.toMatch(/€\s*45/);
    expect(blok).not.toMatch(/€\s*55/);
    // Sanctie: de bronwaarden zelf zijn de verwachte bedragen.
    expect(STARTER.maandprijs).toBe(45);
    expect(STARTER.naMaandprijs).toBe(55);
    expect(STARTER.duurMaanden).toBe(12);
  });

  it("bevat de verplichte toelichting", () => {
    expect(bron).toContain("inclusief kosten en assurantiebelasting");
    expect(bron).toContain("geen eigen risico");
    expect(bron).toContain("KVK-inschrijving jonger dan");
  });

  it("bevat geen verboden woorden in het tariefblok", () => {
    const blok = bron.slice(bron.indexOf('data-testid="startertarief-hero"'), bron.indexOf("benefits={"));
    expect(blok.toLowerCase()).not.toContain("goedkoopste");
    expect(blok.toLowerCase()).not.toContain("advies");
    expect(blok.toLowerCase()).not.toContain("adviseur");
  });
});
