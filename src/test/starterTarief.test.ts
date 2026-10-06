// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STARTER, isStarter, starterTot, bedragVoorPeriode, plusMaanden } from "@/lib/starterTarief";
import { starterContractVelden, pakketSpecVoorLead, maandprijsVoorLead, starterStatus } from "../../supabase/functions/_shared/starterActivatie";
import { contractRegelVoorActivatie } from "../../supabase/functions/_shared/klantContractActivatie";
import { STARTERS_FAQS } from "@/pages/Starters";

describe("starterregel", () => {
  it("jonger dan 12 maanden op ingangsdatum", () => {
    expect(isStarter("2026-01-15", "2026-10-13")).toBe(true);
    expect(isStarter("2025-10-14", "2026-10-13")).toBe(true);
    expect(isStarter("2025-10-13", "2026-10-13")).toBe(false); // precies 12 maanden
    expect(isStarter("2024-02-29", "2025-02-27")).toBe(true);
    expect(isStarter("2024-02-29", "2025-02-28")).toBe(false);
    expect(isStarter(null, "2026-10-13")).toBe(false);
    expect(isStarter("2026-11-01", "2026-10-13")).toBe(false); // startdatum na ingang
    expect(plusMaanden("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("maand: jaar 1 € 45, daarna € 55", () => {
    const tot = starterTot("2026-10-13");
    expect(tot).toBe("2027-10-12");
    expect(bedragVoorPeriode("maand", tot, "2026-11-01")).toBe(45);
    expect(bedragVoorPeriode("maand", tot, "2027-09-01")).toBe(45);
    expect(bedragVoorPeriode("maand", tot, "2027-10-01")).toBe(45);
    expect(bedragVoorPeriode("maand", tot, "2027-11-01")).toBe(55);
  });

  it("jaar: jaar 1 € 495, jaar 2 € 600", () => {
    const tot = starterTot("2026-10-13");
    expect(bedragVoorPeriode("jaar", tot, "2026-10-13")).toBe(495);
    expect(bedragVoorPeriode("jaar", tot, "2027-10-13")).toBe(600);
  });
});

describe("activatie", () => {
  const basis = { id: "11111111-1111-1111-1111-111111111111", ingangsdatum: "2026-10-13", is_test: true };
  it("wacht op controle", () => {
    expect(starterStatus({ ...basis, gekozen_pakket: "jaarlijks", tarief_type: "starter", starter_controle_status: "te_controleren" })).toBe("wacht");
  });
  it("goedgekeurd jaar: eerste factuur 495, contract naar 600", () => {
    const l = { ...basis, gekozen_pakket: "jaarlijks", tarief_type: "starter", starter_controle_status: "goedgekeurd" };
    expect(pakketSpecVoorLead(l, { naam: "x", bedrag: 600, betalingsregel: "" })!.bedrag).toBe(495);
    const rij = contractRegelVoorActivatie(l, "ond", { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: 495, periodeStart: "2026-10-13", periodeEind: "2027-10-12", ...starterContractVelden(l) });
    expect(rij).toMatchObject({ tarief_type: "starter", starter_tot: "2027-10-12", bedrag_na_starter: 600, bedrag_per_periode: 495, itemcode: "100J" });
  });
  it("goedgekeurd maand: 45, daarna 55", () => {
    const l = { ...basis, gekozen_pakket: "maandelijks", tarief_type: "starter", starter_controle_status: "goedgekeurd" };
    expect(maandprijsVoorLead(l, 55)).toBe(45);
    expect(starterContractVelden(l)).toEqual({ tarief_type: "starter", starter_tot: "2027-10-12", bedrag_na_starter: 55 });
  });
  it("afgewezen of standaard: gewone prijs", () => {
    const l = { ...basis, gekozen_pakket: "maandelijks", tarief_type: "standaard", starter_controle_status: "afgewezen" };
    expect(maandprijsVoorLead(l, 55)).toBe(55);
    expect(starterContractVelden(l).tarief_type).toBe("standaard");
    expect(contractRegelVoorActivatie({ ...basis }, "o", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: "2026-10-13", periodeEind: "2026-10-31" }).tarief_type).toBe("standaard");
  });
});

describe("teksten /starters", () => {
  const bron = readFileSync("src/pages/Starters.tsx", "utf8") + JSON.stringify(STARTERS_FAQS);
  it("geen verboden woorden of em dashes", () => {
    expect(bron).not.toMatch(/gratis|goedkoopst|alleen vandaag|verzekeringsbemiddelaar|[\u2013\u2014]/i);
  });
  it("helpers byte-gelijk", () => {
    const a = readFileSync("src/lib/starterTarief.ts", "utf8").split("\n").slice(1).join("\n");
    const b = readFileSync("supabase/functions/_shared/starterTarief.ts", "utf8").split("\n").slice(1).join("\n");
    expect(a).toBe(b);
    expect(STARTER.maandprijs).toBe(45);
  });
});
