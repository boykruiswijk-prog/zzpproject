// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { HANDMATIGE_ONTVANGST } from "../../supabase/functions/_shared/aanvraagBeoordeling";

/** Execute the real mail renderers with sending and database access forbidden. */
const code = readFileSync("supabase/functions/send-lead-notification/index.ts", "utf8").replace(/^import .*;\n/gm, "");
const effect = vi.fn(() => { throw new Error("Mail or database writes forbidden in dry run"); });
const output: any = {};
new Function("exports", "createClient", "Resend", "z", "Deno", "HANDMATIGE_ONTVANGST", "klantVeiligeTekst", ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(output, () => ({}), class { emails = { send: effect }; }, z, { env: { get: () => "" }, serve: () => {} }, HANDMATIGE_ONTVANGST, (s: unknown) => String(s));

describe("alle aanvraagbevestigingen droog", () => {
  it.each(["bav", "verzekering-aanvraag", "offerte-aanvraag", "contact", "terugbelverzoek-chat"])("%s: gewone mail kan zonder verzending worden opgebouwd", type => {
    output.renderCustomerHtml(type, "Aanvraag", { naam: "Test", email: "test@zpzaken.nl" });
    output.renderCustomerText(type, {});
    expect(effect).not.toHaveBeenCalled();
  });
  it.each(["bav", "verzekering-aanvraag", "offerte-aanvraag"])("%s: handmatige ontvangst zonder documentvrijgave", type => {
    const html = output.renderCustomerHtml(type, "Aanvraag", { mandaatkenmerk: "GEHEIM" }, true, "TEST1234");
    const text = output.renderCustomerText(type, { mandaatkenmerk: "GEHEIM" }, true, "TEST1234");
    // This is an operational promise, not a visual/copy snapshot.
    expect(html.includes("Binnen 24 uur geregeld")).toBe(false);
    expect(text.includes("GEHEIM")).toBe(false);
    expect(effect).not.toHaveBeenCalled();
  });
});