// @vitest-environment node
import { describe, it, expect } from "vitest";
import { basisStuksprijs, kortingVoorPeriode, nettoStuksprijs } from "@/lib/contractKorting";
import { bouwFactuurPayload, factuurRegelTekst, kortingTekst } from "../../supabase/functions/_shared/factuurRegel";
import { berekenOpzegCredit, berekenOudSysteemCredit } from "../../supabase/functions/_shared/creditOpzegging";

const k = { korting_pct: 30, korting_vanaf: "2026-11-01", korting_tot: "2027-10-31" };

describe("korting rond de grenzen", () => {
  it("vanaf en tot inclusief, daarbuiten niet", () => {
    expect(kortingVoorPeriode(k, "2026-10-31")).toBeNull();
    expect(kortingVoorPeriode(k, "2026-11-01")).toBe(30);
    expect(kortingVoorPeriode(k, "2027-10-31")).toBe(30);
    expect(kortingVoorPeriode(k, "2027-11-01")).toBeNull();
    expect(kortingVoorPeriode({ ...k, korting_tot: null }, "2040-01-01")).toBe(30);
    expect(kortingVoorPeriode({ korting_pct: null, korting_vanaf: null }, "2026-11-01")).toBeNull();
  });
  it("afronding: 55 x 0,7 = 38,50 en 600 x 0,7 = 420,00", () => {
    expect(nettoStuksprijs(55, 30)).toBe(38.5);
    expect(nettoStuksprijs(600, 30)).toBe(420);
    expect(nettoStuksprijs(55, null)).toBe(55);
  });
  it("starter met korting: korting op de prijs die op dat moment geldt", () => {
    const tijdens = basisStuksprijs("starter", "2026-12-31", 27.5, 55, "2026-12-01");
    const na = basisStuksprijs("starter", "2026-12-31", 27.5, 55, "2027-01-01");
    expect(nettoStuksprijs(tijdens, kortingVoorPeriode(k, "2026-12-01"))).toBe(19.25);
    expect(nettoStuksprijs(na, kortingVoorPeriode(k, "2027-01-01"))).toBe(38.5);
  });
});

describe("Exact-regel met korting", () => {
  const kand = { exact_item_id: "item", aantal: 1, bedrag_per_periode: 38.5, btw_code: "0", gl_code: "8003", exact_account_id: "acc",
    itemcode: "100M", product: "bav_avb", periode_start: "2026-11-01", periode_eind: "2026-11-30", korting_pct: 30 };
  it("UnitPrice netto, omschrijving met korting, max 60 tekens, geen Discount-veld", () => {
    const p = bouwFactuurPayload(kand, null, "ZPF-DRYRUN0", "Remarks");
    const r = p.SalesInvoiceLines[0];
    expect(r.UnitPrice).toBe(38.5);
    expect(r.Description.endsWith(" (30% korting)")).toBe(true);
    expect(r.Description.length).toBeLessThanOrEqual(60);
    expect(r).not.toHaveProperty("Discount");
  });
  it("inkorten gaat ten koste van de periodetekst, nooit van de korting", () => {
    const t = factuurRegelTekst({ itemcode: "450", product: "lidmaatschap_allin", periode_start: "2026-11-01", periode_eind: "2026-11-30", korting_pct: 12.5 });
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith(" (12,5% korting)")).toBe(true);
    expect(t.startsWith("Lidmaatschap ZP Zaken All-in")).toBe(true);
  });
  it("zonder korting ongewijzigd", () => {
    expect(kortingTekst(null)).toBe("");
    expect(factuurRegelTekst({ ...kand, korting_pct: null })).not.toContain("korting");
  });
});

describe("creditnota's met korting", () => {
  it("opzegcredit uit factuur_planning rekent met het betaalde nettobedrag", () => {
    const r = berekenOpzegCredit("2026-11-15", [{ periode_start: "2026-11-01", periode_eind: "2026-11-30", bedrag: 38.5 }]);
    expect(r.bedrag).toBe(Math.round((38.5 / 30) * 15 * 100) / 100);
    expect(r.bedrag).toBeLessThan(Math.round((55 / 30) * 15 * 100) / 100);
  });
  it("AFAS-perioden voor de korting worden tegen de oude prijs gecrediteerd (bedrag_per_periode blijft ongewijzigd)", () => {
    const contract = { cyclus: "jaar", aantal: 1, bedrag_per_periode: 600, begin_datum: "2025-10-01", factureren_vanaf: "2025-10-01", gefactureerd_tm: "2026-09-30",
      korting_pct: 30, korting_vanaf: "2026-10-01", korting_tot: null };
    const r = berekenOudSysteemCredit(contract as any, "2026-06-30");
    expect(r.regels.every((x) => x.periode_eind <= "2026-09-30")).toBe(true);
    expect(r.bedrag).toBe(Math.round((600 / 365) * 92 * 100) / 100);
  });
});
