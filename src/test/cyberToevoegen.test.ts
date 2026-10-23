// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cyberStapKeuze, cyberAfwijsRedenen } from "@/lib/cyberAfwijzing";
import { cyberVerzoekFout } from "@/lib/cyberToevoegen";
import { cyberToevoegenPreview } from "@/config/cyberToevoegen";
import { CYBER, CYBER_VERSIE, beoordeelCyber, aanvraagPremie } from "../../supabase/functions/_shared/cyber";

const goed = { a: false, b: true, c: true, d: true, e: false, f: false };
const moment = new Date("2026-10-23T09:05:00Z");
describe("E-aanvulling 3", () => {
  it.each(["b", "c"])("reden %s houdt de cyberstap open", (reden) => {
    const antwoorden = { ...goed, [reden]: false };
    expect(cyberStapKeuze(antwoorden)).toEqual({ verder: false, cyber: false });
    expect(cyberAfwijsRedenen(antwoorden).map((r) => r.id)).toEqual([reden]);
  });
  it("verder zonder cyber houdt de BAV-aanvraag mogelijk", () => {
    expect(cyberStapKeuze({ ...goed, b: false, c: false }, true)).toEqual({ verder: true, cyber: false });
    expect(aanvraagPremie("maandelijks", false).totaal).toBe(55);
  });
  it("antwoorden corrigeren staat cyber weer toe", () => {
    expect(cyberStapKeuze(goed)).toEqual({ verder: true, cyber: true });
  });
  it.each(["a", "b", "c", "d", "e", "f"])("bestaande acceptatieregel %s blijft", (k) => {
    expect(beoordeelCyber({ ...goed, [k]: !goed[k as keyof typeof goed] }).toegestaan).toBe(false);
  });
  it("onvolledige antwoorden blokkeren ook verder zonder cyber", () => {
    expect(cyberStapKeuze({ b: false }, true).verder).toBe(false);
  });
  it("verzoek vereist alle voorwaarden", () => {
    expect(cyberVerzoekFout({ ...goed, c: false }, "2026-10-24", true, false, "", moment)).not.toBeNull();
  });
  it("geen akkoord betekent geen geldig verzoek", () => {
    expect(cyberVerzoekFout(goed, "2026-10-24", false, false, "", moment)).not.toBeNull();
  });
  it("ingang vroegst morgen in Nederland", () => {
    expect(cyberVerzoekFout(goed, "2026-10-23", true, false, "", moment)).not.toBeNull();
    expect(cyberVerzoekFout(goed, "2026-10-24", true, false, "", moment)).toBeNull();
  });
  it("team voert verplicht een notitie namens klant in", () => {
    expect(cyberVerzoekFout(goed, "2026-10-24", true, true, "", moment)).not.toBeNull();
    expect(cyberVerzoekFout(goed, "2026-10-24", true, true, "Namens klant akkoord", moment)).toBeNull();
  });
  it("prijzen en versie ongewijzigd", () => {
    expect(CYBER.maandprijs).toBe(27.5); expect(CYBER.jaarprijs).toBe(250); expect(CYBER_VERSIE).toBe("2026-10-08");
    expect(aanvraagPremie("jaarlijks-cyber", false).totaal).toBe(850);
  });
  it("latere toevoeging blijft preview-only", () => {
    expect(cyberToevoegenPreview("zpzaken.nl")).toBe(false);
    expect(cyberToevoegenPreview("localhost")).toBe(true);
    expect(cyberToevoegenPreview("id-preview.lovable.app")).toBe(true);
  });
});