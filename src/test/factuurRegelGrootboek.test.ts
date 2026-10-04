// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bouwFactuurPayload, glUitCache, factuurRegelTekst } from "../../supabase/functions/_shared/factuurRegel";

const cfg = { gl_code_bav: "8003", gl_account_id_bav: "GUID-8003", gl_account_id_bav_code: "8003", gl_account_ids: { "8004": "GUID-8004" } };
const basis = { exact_item_id: "item", exact_account_id: "acc", aantal: 1, bedrag_per_periode: 99.5, periode_start: "2026-10-19", periode_eind: "2027-10-18" };

describe("grootboek per regel", () => {
  it("lidmaatschap krijgt GL 8004 en eigen omschrijving", () => {
    const k = { ...basis, itemcode: "450", product: "lidmaatschap_allin", gl_code: "8004" };
    const p = bouwFactuurPayload(k, glUitCache(cfg, k.gl_code), "ZPF-ABCDEF12", "Remarks");
    const r = p.SalesInvoiceLines[0];
    expect(r.GLAccount).toBe("GUID-8004");
    expect(r.Description).toBe("Lidmaatschap ZP Zaken All-in 19-10-26 t/m 18-10-27");
    for (const t of [r.Description, p.Description]) { expect(t).not.toMatch(/BAV-AVB|premie/i); expect(t.length).toBeLessThanOrEqual(60); }
    expect(factuurRegelTekst({ ...k, itemcode: "400" })).toContain("Startup");
    expect(factuurRegelTekst({ ...k, itemcode: "425" })).toContain("Light");
  });
  it("onbekend grootboek geeft geen ID (regel wordt geblokkeerd, niet de run)", () => {
    expect(glUitCache(cfg, "8999")).toBeNull();
  });
  it("BAV-AVB blijft op 8003", () => {
    const k = { ...basis, itemcode: "100-OUDJ540", gl_code: "8003", bedrag_per_periode: 540 };
    const r = bouwFactuurPayload(k, glUitCache(cfg, "8003"), "ZPF-ABCDEF12", "Remarks").SalesInvoiceLines[0];
    expect(r.GLAccount).toBe("GUID-8003");
    expect(r.Description).toContain("BAV-AVB premie");
  });
});
