import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CREDIT_BETAALCONDITIE, creditBetaalconditie } from "../../supabase/functions/_shared/creditBetaalconditie";
import { oudSysteemCreditPayload, plannerCreditPayload } from "../../supabase/functions/_shared/creditOpzegging";
import { bouwFactuurPayload } from "../../supabase/functions/_shared/factuurRegel";

const FN = join(__dirname, "../../supabase/functions");

describe("creditnota's nooit via incasso", () => {
  it("gebruikt bestaande Exact-conditie 07 (betaling binnen 7 dagen), niet IN", () => {
    expect(CREDIT_BETAALCONDITIE).toBe("07");
    expect(creditBetaalconditie()).not.toBe("IN");
  });

  it("plannercreditnota (opzegging en correctie) krijgt conditie 07", () => {
    const basis = { exact_account_id: "a", item: "i", btw: "0", bedrag: 45, credit_vanaf: "2026-10-23", credit_tm: "2026-11-22",
      origineel_factuurnummer: "26700094", creditsleutel: "ZPC-ABCDEF12", vandaag: "2026-11-04" };
    const p = plannerCreditPayload(basis);
    expect(p.PaymentCondition).toBe("07");
    expect(p.Type).toBe(8021);
    expect(p.Status).toBe(20);
    const corr = plannerCreditPayload({ ...basis, bron: "correctie" });
    expect(corr.PaymentCondition).toBe("07");
    expect(String((corr.SalesInvoiceLines[0] as { Description: string }).Description)).toBe("23-10-26 t/m 22-11-26 correctie betaalwijze");
  });

  it("oud-systeem creditnota krijgt conditie 07", () => {
    const p = oudSysteemCreditPayload({ creditsleutel: "ZPC-ABCDEF12", exact_account_id: "a", exact_item_id: "i", einddatum: "2026-10-22",
      credit_vanaf: "2026-10-23", credit_tm: "2027-04-29", vandaag: "2026-11-04", regels: [{ credit_vanaf: "2026-10-23", periode_eind: "2027-04-29", credit_bedrag: 10 }] });
    expect(p.PaymentCondition).toBe("07");
  });

  it("geen enkele creditnota-payload (Type 8021) in de functies zet IN", () => {
    for (const f of ["factuur-planner/index.ts", "_shared/creditOpzegging.ts", "polis-lifecycle/index.ts"]) {
      const s = readFileSync(join(FN, f), "utf8");
      expect(s, f).not.toMatch(/Type:\s*8021[^}]*PaymentCondition:\s*"IN"|PaymentCondition:\s*"IN"[^}]*Type:\s*8021/);
    }
  });

  it("gewone factuur behoudt zijn bestaande conditie", () => {
    const src = readFileSync(join(FN, "_shared/factuurRegel.ts"), "utf8");
    expect(src).toContain('PaymentCondition: "IN"');
    expect(typeof bouwFactuurPayload).toBe("function");
  });
});
