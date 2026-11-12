import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { OPZEG_REDENEN, OPZEG_REDENEN_PORTAAL, OPZEG_REDENEN_BEHEER, portaalRedenCode, opzegRedenTekst } from "@/lib/opzegRedenen";

describe("opzegredenen gelijktrekken (12-11)", () => {
  it("één lijst in de afgesproken volgorde", () => {
    expect(OPZEG_REDENEN.map((r) => r.code)).toEqual(["stoppen_loondienst", "wijzigen_entiteit", "pensioen", "geen_opdracht", "overlijden", "beeindiging_zp", "overgestapt", "anders"]);
    expect(OPZEG_REDENEN.find((r) => r.code === "anders")?.label).toBe("Andere reden (namelijk:)");
  });
  it("klantportaal toont 1-5, 7 en 8, nooit beeindiging_zp", () => {
    expect(OPZEG_REDENEN_PORTAAL.map((r) => r.code)).toEqual(["stoppen_loondienst", "wijzigen_entiteit", "pensioen", "geen_opdracht", "overlijden", "overgestapt", "anders"]);
    expect(portaalRedenCode("beeindiging_zp")).toBeNull();
    expect(portaalRedenCode("iets anders")).toBeNull();
  });
  it("beheer toont alle 8 plus eerdere_opzegging onderaan", () => {
    expect(OPZEG_REDENEN_BEHEER.map((r) => r.code)).toEqual([...OPZEG_REDENEN.map((r) => r.code), "eerdere_opzegging"]);
  });
  it("oude waarden blijven leesbaar", () => {
    expect(opzegRedenTekst({ reden: "stoppen_onderneming" })).toBe("Overlijden of stoppen onderneming");
    expect(opzegRedenTekst({ reden: "ondernemingswijziging", reden_label: "Ondernemingswijziging" })).toBe("Ondernemingswijziging");
    expect(opzegRedenTekst({ reden: "Stoppen met zelfstandig ondernemen" })).toBe("Stoppen met zelfstandig ondernemen");
    expect(opzegRedenTekst({ reden: "pensioen" })).toBe("Pensioen");
  });
  it("oude portaalteksten worden de nieuwe code", () => {
    expect(portaalRedenCode("Anders")).toBe("anders");
    expect(portaalRedenCode("Wijzigen entiteit (bijvoorbeeld omzetting naar BV)")).toBe("wijzigen_entiteit");
  });
  it("frontend en server byte-gelijk", () => {
    expect(readFileSync("supabase/functions/_shared/opzegRedenen.ts", "utf8")).toBe(readFileSync("src/lib/opzegRedenen.ts", "utf8"));
  });
});

describe("oudere polispagina-opzegknop (besluit 12-11)", () => {
  it("gebruikt de beheerlijst: 8 redenen plus eerdere_opzegging, zonder wanbetaling", async () => {
    const { OPZEG_REDENEN_BEHEER } = await import("@/lib/opzegRedenen");
    const codes = OPZEG_REDENEN_BEHEER.map((r) => r.code);
    expect(codes).toHaveLength(9);
    expect(codes).toContain("beeindiging_zp");
    expect(codes).toContain("eerdere_opzegging");
    expect(codes).not.toContain("wanbetaling");
  });
});
