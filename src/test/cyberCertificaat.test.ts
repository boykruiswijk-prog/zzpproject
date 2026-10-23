// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cyberCertificaatRijen, cyberEinddatum, CYBER_POLISNUMMER, CYBER_JAARMAXIMUM } from "../../supabase/functions/_shared/cyberCertificaatTeksten";

const rijen = cyberCertificaatRijen({
  certificaathouder: "Fictief B.V.", kvk: "12345678", verzekeringsnemer: "Test", bav_certificaatnummer: "ZPBAV5193",
  cyber_ingangsdatum: "2026-10-24", afgiftedatum: "2026-10-23", voor_gezien: "Test",
});
const w = (l: string) => rijen.find((r) => r.label === l)?.waarde;

describe("cybercertificaat E5/E5a", () => {
  it("teksten letterlijk", () => {
    expect(CYBER_POLISNUMMER).toBe("HCR3202063");
    expect(w("Bij BAV + AVB-certificaat:")).toBe("ZPBAV5193");
    expect(w("Soort verzekering:")).toBe("CyberClear by Hiscox, ZP Zaken Cyber Collectief");
    expect(w("Polisnummer:")).toBe("HCR3202063");
    expect(w("Ingangsdatum:")).toBe("24-10-2026");
    expect(w("Verzekerd bedrag:")).toBe("EUR 50.000 per schade en per deelnemer (inclusief kosten).\nEUR XXX per verzekeringsjaar voor alle deelnemers samen.");
    expect(rijen.find((r) => r.label === "Verzekerd bedrag:")?.notitie).toBe("Je neemt deel aan een mantelpolis waarbij het maximaal verzekerde bedrag per jaar wordt gedeeld met alle deelnemers binnen de betreffende mantelpolis.");
    expect(w("Eigen risico:")).toBe("EUR 500 per schade, bij cyberfraude EUR 1.000");
    expect(w("Polisvoorwaarden:")).toBe("CyberClear by Hiscox (HCC-2022/01) en de van toepassing zijnde clausules. De voorwaarden zijn op te vragen via 020 - 457 3077.");
    expect(w("Dekkingsgebied:")).toBe("Europa");
    expect(w("Contractduur:")).toBe("24-10-2026 tot en met 23-10-2027. Daarna stilzwijgend verlengd met 12 maanden. Cyber is dagelijks opzegbaar. Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar.");
    expect(w("Prioriteiten:")).toBe("Dit certificaat is gebaseerd op de polisdocumenten onder HCR3202063. Voor zover sprake mocht zijn van tegenstrijdigheden tussen de tekst van dit certificaat en de polisdocumenten, gaan de polisdocumenten voor.");
    expect(w("Melding van schade:")).toBe("Meld een schade of incident zo spoedig als redelijkerwijs mogelijk bij de verzekeraar: Hiscox Nederland (Hiscox incident response team), telefoon +31 (0)20 517 0700, e-mail hiscox.claims@hiscox.nl, Postbus 87033, 1080 JA Amsterdam.");
  });
  it("einddatum is 12 maanden min een dag, ook over schrikkeldag", () => {
    expect(cyberEinddatum("2026-10-24")).toBe("2027-10-23");
    expect(cyberEinddatum("2028-03-01")).toBe("2029-02-28");
  });
  it("jaarbedrag alle deelnemers: config leeg, generator weigert dan, voorbeeld toont XXX", () => {
    expect(CYBER_JAARMAXIMUM).toBe("");
    const src = readFileSync("supabase/functions/generate-cyber-certificate/index.ts", "utf8");
    expect(src).toContain('if (!CYBER_JAARMAXIMUM.trim()) return json(');
    expect(src.indexOf("jaarmaximum_ontbreekt")).toBeLessThan(src.indexOf("tekenCyberCertificaat("));
    const met = cyberCertificaatRijen({ certificaathouder: "F", verzekeringsnemer: "T", bav_certificaatnummer: "ZPBAV1",
      cyber_ingangsdatum: "2026-10-24", afgiftedatum: "2026-10-23", voor_gezien: "T", jaarmaximum: "250.000" });
    expect(met.find((r) => r.label === "Verzekerd bedrag:")?.waarde).toContain("EUR 250.000 per verzekeringsjaar voor alle deelnemers samen.");
  });
  it("BAV-certificaat blijft ongewijzigd", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(src).not.toContain("cyberCertificaat");
    expect(src).toContain('if (heeftNieuweCyber) eigenRisicoLines.push("Cyber: EUR 500 (fraude EUR 1.000).");');
  });
});
