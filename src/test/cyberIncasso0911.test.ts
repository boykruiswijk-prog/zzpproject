import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { certificaatKeuzes, cyberNummer } from "@/lib/certificaatKeuze";
import { cyberCertificaatRijen } from "../../supabase/functions/_shared/cyberCertificaatTeksten";
import { FACTUUR_BETAALTEKST } from "../../supabase/functions/_shared/factuurTekst";
import { bouwFactuurPayload } from "../../supabase/functions/_shared/factuurRegel";
import { jaNee } from "@/lib/mislukteIncassos";

const lees = (p: string) => readFileSync(p, "utf8");

describe("A: PDF als blob", () => {
  it("haalt de PDF via de geauthenticeerde download, niet via een signed URL in een iframe", () => {
    const s = lees("src/components/admin/PdfWeergave.tsx");
    expect(s).toContain(".download(");
    expect(s).not.toContain("createSignedUrl");
    expect(s).toContain("Openen in nieuw tabblad");
    expect(s).toContain("Downloaden");
  });
  it("CSP staat blob-frames toe", () => {
    expect(lees("index.html")).toContain("frame-src blob:");
    expect(lees("public/_headers")).toContain("frame-src blob:");
  });
  it("cyber en BAV gebruiken dezelfde weergave", () => {
    expect(lees("src/components/admin/CyberAanvraag.tsx")).toContain("<PdfWeergave");
    expect(lees("src/components/admin/KlantCertificaat.tsx")).toContain("<PdfWeergave");
  });
});

describe("B: alleen cyber", () => {
  it("biedt alleen keuzes voor wat actief is", () => {
    expect(certificaatKeuzes({ bav: false, cyber: true }).map((k) => k.waarde)).toEqual(["cyber"]);
    expect(certificaatKeuzes({ bav: true, cyber: false }).map((k) => k.waarde)).toEqual(["bav"]);
    expect(certificaatKeuzes({ bav: true, cyber: true }).map((k) => k.label)).toEqual(["BAV + AVB en cyber", "Alleen cyber", "Alleen BAV + AVB"]);
  });
  it("nummerreeks ZPCYB0001", () => {
    expect(cyberNummer(1)).toBe("ZPCYB0001");
    expect(cyberNummer(12345)).toBe("ZPCYB12345");
  });
  it("cybercertificaat toont het eigen nummer in plaats van een BAV-verwijzing", () => {
    const rijen = cyberCertificaatRijen({ cyber_certificaatnummer: "ZPCYB0001" } as any);
    expect(rijen.some((r: any) => r.waarde === "ZPCYB0001")).toBe(true);
    expect(rijen.some((r: any) => String(r.label).includes("BAV"))).toBe(false);
  });
  it("server weigert een nieuw BAV-document voor een klant met alleen cyber", () => {
    expect(lees("supabase/functions/generate-certificate/index.ts")).toContain('code: "alleen_cyber"');
  });
});

describe("C: incasso", () => {
  it("elke factuur draagt het rekeningnummer van ZP Zaken", () => {
    expect(FACTUUR_BETAALTEKST).toContain("NL25 ABNA 0477 3302 23");
    const p = bouwFactuurPayload({ exact_item_id: "i", aantal: 1, bedrag_per_periode: 55, btw_code: "0", gl_code: "8003", periode_start: "2026-12-01", periode_eind: "2026-12-31", exact_account_id: "a" }, null, "ZPF-1", "Remarks");
    expect(p.InvoiceText).toBe(FACTUUR_BETAALTEKST);
    expect(lees("supabase/functions/lead-to-exact-activate/index.ts")).toContain("InvoiceText: FACTUUR_BETAALTEKST");
  });
  it("creditnota's krijgen geen betaaltekst", () => {
    expect(lees("supabase/functions/_shared/creditOpzegging.ts")).not.toContain("FACTUUR_BETAALTEKST");
  });
  it("bankgegevens-sync haalt nooit een rekeningnummer op", () => {
    const s = lees("supabase/functions/exact-finance-sync/index.ts");
    expect(s).toContain("crm/BankAccounts?$select=ID,Account`");
    expect(s).not.toMatch(/BankAccounts\?\$select=[^`]*BankAccount[^s]/);
  });
  it("lijst voor Sandra toont geen rekeningnummers", () => {
    const s = lees("src/components/admin/incasso/MislukteIncassos.tsx");
    expect(s).not.toMatch(/iban/i);
    expect(jaNee(null)).toBe("Nog niet opgehaald");
  });
  it("daglijst maximaal een melding per dag", () => {
    const s = lees("drizzle/migrations/0264_mislukte_incassos_overzicht.sql");
    expect(s).toContain("incasso_daglijst_claim WHERE dag = _dag");
    expect(s).toContain("dag date PRIMARY KEY");
  });
});
