import { describe, expect, it } from "vitest";
import { besluitRelatie, opvolgerPayload, relatieNaamKern } from "../../supabase/functions/_shared/exactRelatie";

const r = (ID: string, Name: string, ChamberOfCommerce: string | null = null, Code = "1") => ({ ID, Name, ChamberOfCommerce, Code });

describe("Exact-relatie voor rechtsopvolger", () => {
  it("koppelt een bestaande relatie met hetzelfde KvK-nummer", () => {
    const b = besluitRelatie({ kvk: "42204421", naam: "Let's GO Labels BV", kvkTreffers: [r("a", "Iets", "42204421")], naamTreffers: [] });
    expect(b).toMatchObject({ soort: "koppelen", reden: "kvk" });
  });
  it("de relatie van de voorganger telt nooit mee, ook niet op naam", () => {
    const b = besluitRelatie({ kvk: "42204421", naam: "Let's GO Labels BV", kvkTreffers: [], naamTreffers: [r("oud", "Let's GO labels")], uitsluiten: ["OUD"] });
    expect(b.soort).toBe("aanmaken");
  });
  it("koppelt op naam zonder ander KvK-nummer", () => {
    const b = besluitRelatie({ kvk: "42204421", naam: "Let's GO Labels BV", kvkTreffers: [], naamTreffers: [r("x", "Let’s GO Labels B.V.")] });
    expect(b).toMatchObject({ soort: "koppelen", reden: "naam" });
  });
  it("naamgenoot met ander KvK-nummer is een andere onderneming", () => {
    const b = besluitRelatie({ kvk: "42204421", naam: "Let's GO Labels BV", kvkTreffers: [], naamTreffers: [r("x", "Let's GO Labels", "11111111")] });
    expect(b.soort).toBe("aanmaken");
  });
  it("twee kandidaten: handmatig, nooit aanmaken", () => {
    const b = besluitRelatie({ kvk: "42204421", naam: "Abc BV", kvkTreffers: [], naamTreffers: [r("1", "Abc"), r("2", "ABC B.V.")] });
    expect(b.soort).toBe("handmatig");
  });
  it("rechtsvorm telt niet mee in de naamkern", () => {
    expect(relatieNaamKern("Let’s GO Labels B.V.")).toBe("let's go labels");
  });
  it("payload: naam en KvK van opvolger, geen bank- of mandaatvelden", () => {
    const p = opvolgerPayload({ naam: "Let's GO Labels BV", kvk: "42204421" }, { Code: " 2008393", City: "Edam", Email: "a@b.nl", IBAN: "x" }, { voorgangerNaam: "Let's GO labels", ingangsdatum: "2026-10-26" });
    expect(p).toMatchObject({ Name: "Let's GO Labels BV", ChamberOfCommerce: "42204421", City: "Edam", Country: "NL" });
    expect(Object.keys(p)).not.toContain("IBAN");
    expect(String(p.Remarks)).toContain("relatie 2008393");
  });
});
