// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  afwijkingNieuwNummer, bepaalKeuze, magBevestigen, magNummerOpslaan, magNummerWijzigen, startVoorstel,
} from "@/lib/certificaatNummerKeuze";

const leeg = { voorstel: { nummer: null, bron: "geen" }, klantopgave: null, voorbeeld: "ZPBAV5178" };

describe("A14 nummerkeuze lead-route", () => {
  it("bekend nummer gaat voor en wordt voorgesteld", () => {
    const c = { voorstel: { nummer: "ZPBAV5001", bron: "bevestigd" }, klantopgave: null, voorbeeld: null };
    expect(startVoorstel(c)).toEqual({ nummer: "ZPBAV5001", bron: "bevestigd" });
    expect(bepaalKeuze(" zpbav5001 ", c).soort).toBe("bekend");
  });
  it("zonder bekend nummer: voorbeeld = nieuw, getypt = eigen met verplichte toelichting", () => {
    expect(startVoorstel(leeg).bron).toBe("nieuw");
    expect(bepaalKeuze("ZPBAV5178", leeg).soort).toBe("nieuw");
    const eigen = bepaalKeuze("ZPBAV4000", leeg);
    expect(eigen.soort).toBe("eigen");
    expect(magBevestigen(eigen, "")).toBe(false);
    expect(magBevestigen(eigen, "oude polis")).toBe(true); // blokkade opheffen: toelichting invullen
  });
  it("klantopgave wordt voorgesteld en bij bevestigen vastgelegd", () => {
    const c = { ...leeg, klantopgave: "zpbav 4500" };
    expect(startVoorstel(c).nummer).toBe("ZPBAV4500");
    expect(bepaalKeuze("ZPBAV4500", c).soort).toBe("klantopgave");
  });
  it("ongeldig formaat is geweigerd", () => {
    expect(magBevestigen(bepaalKeuze("ab", leeg), "x")).toBe(false);
    expect(bepaalKeuze("ZP#1", leeg).soort).toBe("ongeldig");
  });
  it("gelijktijdigheid toont het echte nummer", () => {
    expect(afwijkingNieuwNummer("ZPBAV5178", "ZPBAV5178")).toBeNull();
    expect(afwijkingNieuwNummer("ZPBAV5178", "ZPBAV5179")).toContain("ZPBAV5179");
  });
});

describe("A14 nummer wijzigen", () => {
  it("reden minimaal 10 tekens en nummer moet anders zijn", () => {
    expect(magNummerOpslaan("ZPBAV1", "ZPBAV2", "kort")).toBe(false);
    expect(magNummerOpslaan("ZPBAV2", "ZPBAV2", "lange reden hier")).toBe(false);
    expect(magNummerOpslaan("ZPBAV1", "ZPBAV2", "lange reden hier")).toBe(true);
  });
  it("alleen supervisor, admin en verzekering", () => {
    expect(["admin", "supervisor", "verzekering"].every(magNummerWijzigen)).toBe(true);
    expect(magNummerWijzigen("medewerker")).toBe(false);
    expect(magNummerWijzigen(null)).toBe(false);
  });
  it("server: lead-route stuurt nooit stil een leeg nummer zonder controle en kent nummer_wijzigen", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(src).toContain('rpc("policy_nummer_wijzigen"');
    expect(src).toContain("Geen bekend BAV-nummer; bevestig eerst een nummer");
    expect(src).not.toMatch(/mailCertificaat\([^)]*\)[\s\S]{0,40}nummer_wijzigen/);
  });
});
