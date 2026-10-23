// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cyberToevoegMailData, cyberToevoegSpec, CYBER_TOEVOEG_MAIL } from "../../supabase/functions/_shared/cyberToevoegenActivatie";
import { vulPlaceholders } from "@/lib/klantmailTekst";
import { verstuurKlantmail } from "../../supabase/functions/_shared/klantmailSchakelaar";

describe("E4 eigen cyberfacturatie", () => {
  it("jaar: EUR 250 op eigen ingang en opnieuw na twaalf maanden", () => {
    expect(cyberToevoegSpec("2026-11-03", "jaar")).toMatchObject({ itemcode: "102J", aantal: 1, bedrag_per_periode: 250, periode_start: "2026-11-03", periode_eind: "2027-11-02", cyber_einddatum: "2027-11-02" });
    expect(cyberToevoegSpec("2026-11-03", "jaar", 1).periode_start).toBe("2027-11-03");
  });
  it("maand: EUR 27,50 vanaf eigen ingang met aparte jaarlooptijd", () => {
    expect(cyberToevoegSpec("2026-11-03", "maand")).toMatchObject({ itemcode: "102M", aantal: 1, bedrag_per_periode: 27.5, periode_start: "2026-11-03", periode_eind: "2026-12-02", cyber_einddatum: "2027-11-02" });
    expect(cyberToevoegSpec("2026-11-03", "maand", 1).periode_start).toBe("2026-12-03");
  });
  it("herhaalde cyberpayload levert hetzelfde periodevoorstel", () => {
    const a = cyberToevoegSpec("2026-11-03", "jaar");
    expect(cyberToevoegSpec("2026-11-03", "jaar")).toEqual(a);
  });
  it.each(["jaar", "maand"] as const)("maildata %s heeft juiste incasso en ingangsdatum", (cyclus) => {
    const data = cyberToevoegMailData("Test", "2026-11-03", cyclus);
    expect(data.ingangsdatum).toBe("03-11-2026");
    expect(data.cyber_premie).toBe(cyclus === "jaar" ? "EUR 250 per jaar" : "EUR 27,50 per maand");
    expect(data.cyber_incasso).toBe(cyclus === "jaar" ? "jaarlijks vooraf" : "maandelijks");
    expect(() => vulPlaceholders(CYBER_TOEVOEG_MAIL, data)).not.toThrow();
  });
  it("droge mailrun verstuurt en logt niets", async () => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const insert = vi.fn();
    const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: { actief: true, status: "goedgekeurd_boy", onderwerp: "Je cyberverzekering is toegevoegd", tekst: CYBER_TOEVOEG_MAIL }, error: null }), insert };
    const status = await verstuurKlantmail({ from: () => api }, new Request("https://zpzaken.nl"), "cyber-toevoegen-activeren", "cyber_toegevoegd", "test@zpzaken.nl", cyberToevoegMailData("Test", "2026-11-03", "jaar"), {}, { dryRun: true });
    expect(status).toBe("zou_verzenden");
    expect(network).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it.each([[422, "mail_mislukt"], [503, "mail_onzeker"], [200, "verzonden"]])("provider %s classificeert veilig als %s", async (http, expected) => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const network = vi.fn().mockResolvedValue(new Response("{}", { status: Number(http) }));
    vi.stubGlobal("fetch", network);
    const insert = vi.fn();
    const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: { actief: true, status: "goedgekeurd_boy", onderwerp: "Cyber", tekst: CYBER_TOEVOEG_MAIL }, error: null }), insert };
    try {
      const result = await verstuurKlantmail({ from: () => api }, new Request("https://zpzaken.nl"), "cyber-toevoegen-activeren", "cyber_toegevoegd", "test@zpzaken.nl", cyberToevoegMailData("Test", "2026-11-03", "jaar"), {}, { classifyDelivery: true, attachments: [{ filename: "test.pdf", content: "dGVzdA==" }], idempotencyKey: "test-attempt-1" });
      expect(result).toBe(expected);
      expect(network).toHaveBeenCalledTimes(1);
      expect(JSON.parse(network.mock.calls[0][1].body).attachments).toEqual([{ filename: "test.pdf", content: "dGVzdA==" }]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("cyber confirmation has no certificate attachment", async () => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const network = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", network);
    const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: { actief: true, status: "goedgekeurd_boy", onderwerp: "Cyber", tekst: CYBER_TOEVOEG_MAIL } }), insert: vi.fn() };
    try {
      await verstuurKlantmail({ from: () => api }, new Request("https://zpzaken.nl"), "cyber-toevoegen-activeren", "cyber_toegevoegd", "test@zpzaken.nl", cyberToevoegMailData("Test", "2026-11-03", "jaar"), {}, { idempotencyKey: "test-confirmation" });
      expect(JSON.parse(network.mock.calls[0][1].body).attachments).toBeUndefined();
    } finally { vi.unstubAllGlobals(); }
  });
});