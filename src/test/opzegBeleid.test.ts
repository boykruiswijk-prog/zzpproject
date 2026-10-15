// @vitest-environment node
// Besluit Boy 15-10-2026 (D1-aanvulling 2): maand en cyber per dag opzegbaar zonder creditnota.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { opzegCreditBeleid } from "@/lib/opzegBeleid";

describe("opzegCreditBeleid", () => {
  it("maand, jaar, cyber maand, cyber jaar", () => {
    expect(opzegCreditBeleid({ cyclus: "maand", product: "bav_avb" })).toBe("geen_credit_maand");
    expect(opzegCreditBeleid({ cyclus: "jaar", product: "bav_avb" })).toBe("credit_jaar_wacht_op_boy");
    expect(opzegCreditBeleid({ cyclus: "maand", product: "cyber_clear" })).toBe("geen_credit_cyber");
    expect(opzegCreditBeleid({ cyclus: "jaar", product: "cyber_clear" })).toBe("geen_credit_cyber");
  });
  it("frontend en shared helper zijn byte-gelijk", () => {
    expect(readFileSync("src/lib/opzegBeleid.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/opzegBeleid.ts", "utf8"));
  });
  it("migratie plan_opzeg_credit: niet_nodig voor maand en cyber, jaar wacht op Boy", () => {
    const dir = "drizzle/migrations";
    const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes("opzeggen_zonder_credit_maand_cyber"))}`, "utf8");
    expect(sql).toContain("IF k.cyclus = ''maand'' THEN");
    expect(sql).toContain("Maandpolis: per dag opzegbaar, geen creditnota (besluit 15-10-2026)");
    expect(sql).toContain("IF k.product LIKE ''cyber%'' THEN");
    expect(sql).toContain("Cyber: per dag opzegbaar, nooit creditnota (besluit 15-10-2026)");
    expect(sql).toContain("D1 jaarpolis, wacht op Boy");
    // cyber-uitzondering (lopende periode afmaken) vervalt: alle contracten stoppen per dag
    expect(sql).toContain("'(p.ps > p.opz)'");
  });
  it("polis-lifecycle: maandpolis geen creditnota, pauze ongewijzigd", () => {
    const s = readFileSync("supabase/functions/polis-lifecycle/index.ts", "utf8");
    expect(s).toContain("Maandpolis: geen creditnota (besluit 15-10-2026)");
    expect(s).toContain('beleid === "credit_jaar_wacht_op_boy" && vanuitActief');
    expect(s).toContain("Pauze: geen besluit 15-10, ongewijzigd");
    expect(s).toContain("D1 jaarpolis, wacht op Boy");
  });
});
