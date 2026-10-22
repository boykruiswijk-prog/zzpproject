// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { aanvraagDocumenten, beoordelingKeuze } from "../../supabase/functions/_shared/aanvraagBeoordeling";

describe("documentvrijgave en SEPA-uitzondering", () => {
  it.each([false, true])("SEPA-keuze %s is alleen geldig na vastgelegd akkoord", geenSepa => {
    const pending = { vereist_handmatige_beoordeling: true, extra_data: { handmatige_acceptatie: { geen_sepa_nodig: geenSepa } } };
    expect(beoordelingKeuze(pending.extra_data).akkoord).toBe(false);
    expect(aanvraagDocumenten(pending, "ontvangst", geenSepa)).toEqual({ handmatig: true, sepa: false, mijnZp: false, certificaat: false });
  });
  it("Exact heeft geen SEPA-POST bij opgeslagen geen-SEPA keuze", () => {
    const code = readFileSync("supabase/functions/lead-to-exact-activate/index.ts", "utf8");
    // Guard around the existing mandate block, not a copy or layout assertion.
    const block = code.slice(code.indexOf("if (!exactMandateId && !geenSepaNodig)"));
    expect(block.indexOf("cashflow/DirectDebitMandates")).toBeGreaterThan(0);
    expect(code.indexOf('action === "activate" && handmatig && !acceptatieKeuze.akkoord')).toBeLessThan(code.indexOf("ensureValidToken("));
  });
});