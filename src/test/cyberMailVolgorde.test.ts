// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { cyberMailVolgorde } from "../../supabase/functions/_shared/cyberMailVolgorde";
import { mailCertificaat } from "../../supabase/functions/_shared/certificaatMail";
import { verstuurKlantmail } from "../../supabase/functions/_shared/klantmailSchakelaar";
import { CYBER_TOEVOEG_MAIL, cyberToevoegMailData } from "../../supabase/functions/_shared/cyberToevoegenActivatie";
afterEach(() => vi.unstubAllGlobals());
describe("cyber certificate then confirmation", () => {
  it("certificate failure prevents confirmation", async () => {
    const bevestiging = vi.fn();
    expect(await cyberMailVolgorde(async () => ({ ok: false, status: "mail_onzeker" }), bevestiging)).toEqual({ certificaat: "mail_onzeker", bevestiging: "niet_verzonden_certificaat" });
    expect(bevestiging).not.toHaveBeenCalled();
  });
  it("dry run exercises both actual send helpers in order without effects", async () => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const log = vi.fn(); const download = vi.fn();
    const q: any = { select: () => q, eq: () => q, single: async () => ({ data: {} }), maybeSingle: async () => ({ data: { email: "test@zpzaken.nl", voornaam: "Test", actief: true, status: "goedgekeurd_boy", onderwerp: "Cyber", tekst: CYBER_TOEVOEG_MAIL } }), insert: log };
    const db = { from: () => q, storage: { from: () => ({ download }) } };
    const order: string[] = [];
    const req = new Request("https://zpzaken.nl");
    const result = await cyberMailVolgorde(async () => {
      order.push("certificaat");
      return mailCertificaat(db, req, { lead_id: "test-lead", pdf_url: "test.pdf", certificate_number: "ZPBAVTEST" }, { id: "test-reviewer" }, { dryRun: true });
    }, async () => {
      order.push("bevestiging");
      return verstuurKlantmail(db, req, "cyber-toevoegen-activeren", "cyber_toegevoegd", "test@zpzaken.nl", cyberToevoegMailData("Test", "2026-10-24", "jaar"), {}, { dryRun: true });
    });
    expect(order).toEqual(["certificaat", "bevestiging"]);
    expect(result).toEqual({ certificaat: "zou_verzenden", bevestiging: "zou_verzenden" });
    expect(network).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled();
  });
});