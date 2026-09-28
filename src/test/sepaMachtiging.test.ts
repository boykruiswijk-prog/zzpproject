import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as front from "@/lib/sepaMachtiging";
import * as server from "../../supabase/functions/_shared/sepaMachtiging";

const voorbeeld = (type: "doorlopend" | "eenmalig") => ({
  type,
  incassantNaam: "ZP Zaken B.V.",
  incassantAdres: "Tupolevlaan 41, 1119 NW Schiphol-Rijk, Nederland",
  incassantId: "NL00ZZZ000000000000",
  mandaatkenmerk: front.mandaatkenmerkVoor("3f2b8c1e-1234-4abc-9def-0123456789ab"),
  reden: type === "doorlopend" ? front.redenBav() : front.redenScreening("Basis screening", 49),
  debiteurNaam: "TEST-Voorbeeld B.V.",
  debiteurAdres: { straat: "Voorbeeldstraat", huisnummer: "1", postcode: "1234 AB", plaats: "Amsterdam", land: "Nederland" },
  iban: "NL91ABNA0417164300",
});

describe("SEPA-machtigingstekst", () => {
  it("frontend- en serverbestand zijn byte-voor-byte gelijk", () => {
    const a = readFileSync(resolve(__dirname, "../lib/sepaMachtiging.ts"), "utf8");
    const b = readFileSync(resolve(__dirname, "../../supabase/functions/_shared/sepaMachtiging.ts"), "utf8");
    expect(a).toBe(b);
  });

  it.each(["doorlopend", "eenmalig"] as const)("render en hash zijn gelijk (%s)", (type) => {
    const t1 = front.renderMachtigingstekst(voorbeeld(type));
    const t2 = server.renderMachtigingstekst(voorbeeld(type));
    expect(t1).toBe(t2);
    const h = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    expect(h(t1)).toBe(h(t2));
    expect(t1).toContain("binnen 8 weken");
    expect(t1).toContain(front.ELEKTRONISCH_ONDERTEKENEN_ZIN);
  });

  it("kenmerk is 35 tekens, ZPZ + UUID zonder streepjes", () => {
    const k = front.mandaatkenmerkVoor("3f2b8c1e-1234-4abc-9def-0123456789ab");
    expect(k).toBe("ZPZ3F2B8C1E12344ABC9DEF0123456789AB");
    expect(k).toHaveLength(35);
  });

  it("IBAN-validatie en maskering", () => {
    expect(front.isValidIban("NL91 ABNA 0417 1643 00")).toBe(true);
    expect(front.isValidIban("NL91ABNA0417164301")).toBe(false);
    expect(front.maskeerIban("NL91ABNA0417164300")).toBe("NL91 **** **** 4300");
  });
});
