import { describe, it, expect } from "vitest";
import { bouwFactuurPayload } from "../../supabase/functions/_shared/factuurRegel";

describe("InvoiceText besluit 12 november", () => {
  it("stuurt geen InvoiceText naar Exact", () => {
    const p = bouwFactuurPayload({ exact_item_id: "i", exact_account_id: "a", aantal: 1, bedrag_per_periode: 55, gl_code: "8003", btw_code: "0", periode_start: "2026-11-12", periode_eind: "2026-12-11" }, null, "ZPF-TEST", "Remarks");
    expect(p).not.toHaveProperty("InvoiceText");
  });
});