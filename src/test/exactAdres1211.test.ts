import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { adresVoorExact, beveiligdAdres, controleerAdresSchrijfactie, verwerkAdres, type Exact } from "../../supabase/functions/_shared/exactAdres";

const ID = "0b30af73-7fde-403b-b8d9-b6fbb19916c9";
const pad = `crm/Accounts(guid'${ID}')`;
const tn = { straat: "Jacob van Campenlaan", huisnummer: "106A", postcode: "1222kp", plaats: "Hilversum" };

describe("Exact-adres allowlist (akkoord Boy 12-11)", () => {
  it("staat alleen adresvelden toe", () => {
    expect(() => controleerAdresSchrijfactie("PUT", pad, { AddressLine1: "x 1", Postcode: "1222 KP", City: "H", Country: "NL" })).not.toThrow();
    for (const veld of ["Name", "Email", "Phone", "BankAccount", "IBAN", "ChamberOfCommerce"])
      expect(() => controleerAdresSchrijfactie("PUT", pad, { AddressLine1: "x 1", [veld]: "y" })).toThrow();
  });
  it("weigert POST, andere paden en lege waarden", () => {
    expect(() => controleerAdresSchrijfactie("POST", "crm/Accounts", { City: "H" })).toThrow();
    expect(() => controleerAdresSchrijfactie("PUT", "salesinvoice/SalesInvoices", { City: "H" })).toThrow();
    expect(() => controleerAdresSchrijfactie("PUT", pad, { City: "" })).toThrow();
    expect(() => controleerAdresSchrijfactie("PUT", pad, {})).toThrow();
  });
  it("bouwt het adres en markeert twijfel", () => {
    expect(adresVoorExact(tn)).toEqual({ adres: { AddressLine1: "Jacob van Campenlaan 106A", Postcode: "1222 KP", City: "Hilversum", Country: "NL" } });
    expect("twijfel" in adresVoorExact({ ...tn, straat: "J.B Bakemakade 38", huisnummer: "38" })).toBe(true);
    expect("twijfel" in adresVoorExact({ ...tn, plaats: "" })).toBe(true);
  });
});

function nep(exactAdres: any, putOk = true) {
  const aanroepen: any[] = [];
  let huidig = { ...exactAdres };
  const ruw: Exact = async (m, p, b) => {
    aanroepen.push({ m, p, b });
    if (m === "PUT") { if (!putOk) return { ok: false, status: 400, data: null, tekst: "Ongeldig" }; huidig = { ...huidig, ...b }; return { ok: true, status: 204, data: null, tekst: "" }; }
    return { ok: true, status: 200, data: { d: huidig }, tekst: "" };
  };
  return { ex: beveiligdAdres(ruw), aanroepen };
}

describe("verwerkAdres", () => {
  it("PUT bevat uitsluitend adresvelden en wordt teruggelezen", async () => {
    const { ex, aanroepen } = nep({ AddressLine1: "Polluxstraat 6", Postcode: "1223 GB", City: "Hilversum", Country: "NL " });
    const u = await verwerkAdres(ex, ID, tn, true);
    expect(u.status).toBe("bijgewerkt");
    const put = aanroepen.find((a) => a.m === "PUT");
    expect(Object.keys(put.b).sort()).toEqual(["AddressLine1", "City", "Country", "Postcode"]);
    expect(aanroepen.at(-1).m).toBe("GET");
  });
  it("droog doet geen PUT; gelijk adres ook niet", async () => {
    const a = nep({ AddressLine1: "x", Postcode: "1", City: "y", Country: "NL" });
    expect((await verwerkAdres(a.ex, ID, tn, false)).status).toBe("droog_bijwerken");
    expect(a.aanroepen.some((x) => x.m === "PUT")).toBe(false);
    const b = nep({ AddressLine1: "Jacob van Campenlaan 106A", Postcode: "1222 KP", City: "Hilversum", Country: "NL " });
    expect((await verwerkAdres(b.ex, ID, tn, true)).status).toBe("gelijk");
    expect(b.aanroepen.some((x) => x.m === "PUT")).toBe(false);
  });
  it("fout bij Exact geeft status fout (niet stil)", async () => {
    const { ex } = nep({ AddressLine1: "Polluxstraat 6", Postcode: "1223 GB", City: "Hilversum", Country: "NL" }, false);
    const u = await verwerkAdres(ex, ID, tn, true);
    expect(u.status).toBe("fout");
    expect(u.melding).toContain("PUT adres 400");
  });
  it("functie maakt bij fout een wijzigingsmelding en laat de rij open", () => {
    const src = readFileSync("supabase/functions/exact-adres-sync/index.ts", "utf8");
    expect(src).toContain('from("wijzigingsmeldingen").insert');
    expect(src).toContain('if (u.status !== "fout") patch.verwerkt_op');
    expect(src).toContain('"exact_adres_bijgewerkt"');
  });
});
