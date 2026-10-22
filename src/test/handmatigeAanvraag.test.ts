// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { aanvraagDocumenten, beoordelingKeuze, handmatigeAanvraag } from "../../supabase/functions/_shared/aanvraagBeoordeling";
import { readFileSync } from "node:fs";
import ts from "typescript";
const verstuurMachtigingBevestiging = vi.fn(async () => {});
const autoInvitePortalLead = vi.fn(async () => ({ verstuurd: true }));
const source = readFileSync("supabase/functions/_shared/handmatigeDocumenten.ts", "utf8").replace(/^import .*;\n/gm, "");
const output: any = {};
new Function("exports", "beoordelingKeuze", "handmatigeAanvraag", "verstuurMachtigingBevestiging", "autoInvitePortalLead", "COMPANY_ADDRESS_FULL", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(output, beoordelingKeuze, handmatigeAanvraag, verstuurMachtigingBevestiging, autoInvitePortalLead, "Testadres");
const verstuurHandmatigeDocumenten = output.verstuurHandmatigeDocumenten;

const basis = { id: "test-id", vereist_handmatige_beoordeling: true, is_test: false, email: "test@zpzaken.nl", extra_data: { handmatige_acceptatie: { bevestigd_op: "2026-10-22", geen_sepa_nodig: false } } };
describe("handmatige acceptatie", () => {
  it("gewone ontvangst blijft SEPA meteen vrijgeven", () => {
    expect(aanvraagDocumenten({}, "ontvangst")).toEqual({ sepa: true, certificaat: false, mijnZp: false, handmatig: false });
  });
  it("handmatige ontvangst geeft geen documenten vrij, ook bij afwijking buiten zorg/bouw", () => {
    expect(aanvraagDocumenten({ vereist_handmatige_beoordeling: true }, "ontvangst")).toEqual({ sepa: false, certificaat: false, mijnZp: false, handmatig: true });
    expect(handmatigeAanvraag({ extra_data: { handmatige_acceptatie: {} } })).toBe(true);
  });
  it.each([false, true])("akkoord met geen SEPA=%s: certificaat/portaal wel, SEPA alleen indien nodig", async geenSepa => {
    vi.clearAllMocks();
    const mail = vi.fn(async () => ({ ok: true }));
    const row = { ...basis, extra_data: { handmatige_acceptatie: { bevestigd_op: "2026-10-22", geen_sepa_nodig: geenSepa } } };
    const db = { from: (table: string) => {
      const api: any = { select: () => api, eq: () => api, order: () => api, limit: () => api,
        maybeSingle: async () => ({ data: { id: "bewijs", bevestigingsmail_verzonden_op: "2026-10-22" } }),
        then: (resolve: any) => resolve({ data: [] }) };
      return api;
    } };
    const result = await verstuurHandmatigeDocumenten(db, new Request("https://example.test"), row, "user", mail);
    expect(result).toEqual({ certificaat: true, sepa: !geenSepa, mijnZp: true });
    expect(mail).toHaveBeenCalledTimes(1); expect(autoInvitePortalLead).toHaveBeenCalledTimes(1);
    expect(aanvraagDocumenten(row, "akkoord", geenSepa).sepa).toBe(!geenSepa);
    expect(beoordelingKeuze(row.extra_data).geenSepa).toBe(geenSepa);
    expect(verstuurMachtigingBevestiging).not.toHaveBeenCalled(); // already sent evidence is not resent
  });
  it("geen akkoord weigert vóór mail", async () => {
    const mail = vi.fn();
    await expect(verstuurHandmatigeDocumenten({}, new Request("https://example.test"), { ...basis, extra_data: {} }, "user", mail)).rejects.toThrow("nog niet goedgekeurd");
    expect(mail).not.toHaveBeenCalled();
  });
  it("testaanvraag verstuurt nooit klantdocumenten", async () => {
    const mail = vi.fn();
    expect(await verstuurHandmatigeDocumenten({}, new Request("https://example.test"), { ...basis, is_test: true }, "user", mail)).toMatchObject({ test: true, certificaat: false, sepa: false, mijnZp: false });
    expect(mail).not.toHaveBeenCalled();
  });
  it("nieuwe SEPA wordt alleen bij akkoord uit bestaand bewijs verzonden, niet opnieuw opgebouwd", async () => {
    vi.clearAllMocks();
    let sent = false;
    verstuurMachtigingBevestiging.mockImplementationOnce(async () => { sent = true; });
    const proof = { id: "bewijs", type: "doorlopend", incassant_naam: "Test", incassant_id: "TEST", mandaatkenmerk: "ZPZTEST", reden: "Test", debiteur_naam: "Test", debiteur_adres: {}, iban: "TEST", tekst_hash: "hash", getoonde_tekst: "onveranderlijk" };
    const db = { from: (table: string) => {
      const api: any = { select: () => api, eq: () => api, order: () => api, limit: () => api,
        maybeSingle: async () => ({ data: { ...proof, bevestigingsmail_verzonden_op: sent ? "2026-10-22" : null } }),
        then: (resolve: any) => resolve({ data: [] }) };
      return api;
    } };
    const result = await verstuurHandmatigeDocumenten(db, new Request("https://example.test"), basis, "user", async () => ({ ok: true }));
    expect(result.sepa).toBe(true);
    expect(verstuurMachtigingBevestiging).toHaveBeenCalledTimes(1);
    expect(verstuurMachtigingBevestiging).toHaveBeenCalledWith(db, expect.anything(), expect.objectContaining({ record: expect.objectContaining({ tekst_hash: "hash", getoonde_tekst: "onveranderlijk" }) }));
  });
});

function historieDb({ sepaLog = false, portalLog = false, invitation = false, error = false } = {}) {
  return { from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const api: any = { select: () => api, order: () => api, limit: () => api,
      eq: (key: string, value: unknown) => { filters[key] = value; return api; },
      maybeSingle: async () => ({ data: { id: "test-bewijs", bevestigingsmail_verzonden_op: null } }),
      then: (resolve: any) => resolve({ error: error ? { message: "read failed" } : null,
        data: table === "portal_invitations" ? (invitation ? [{ id: "test-inv" }] : []) :
          filters["metadata->>bewijs_id"] ? (sepaLog ? [{ id: "test-sepa-log" }] : []) :
            (portalLog ? [{ lead_type: "portal_invite", metadata: {} }] : []) }) };
    return api;
  } };
}

describe("oude handmatige aanvragen en veilige droge akkoordroute", () => {
  it("SEPA-sent-log zonder bijgewerkte bewijstimestamp en eerdere Mijn ZP-mail: alleen certificaat", async () => {
    vi.clearAllMocks();
    const mail = vi.fn(async () => ({ ok: true }));
    await verstuurHandmatigeDocumenten(historieDb({ sepaLog: true, portalLog: true }), new Request("https://example.test"), basis, "user", mail);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(verstuurMachtigingBevestiging).not.toHaveBeenCalled();
    expect(autoInvitePortalLead).not.toHaveBeenCalled();
  });
  it("bestaande uitnodiging voorkomt opnieuw uitnodigen", async () => {
    vi.clearAllMocks();
    await verstuurHandmatigeDocumenten(historieDb({ sepaLog: true, invitation: true }), new Request("https://example.test"), basis, "user", async () => ({ ok: true }));
    expect(autoInvitePortalLead).not.toHaveBeenCalled();
  });
  it.each([false, true])("droog testlead-akkoord geen SEPA=%s zonder writes of verzending", async geenSepa => {
    vi.clearAllMocks();
    const mail = vi.fn(() => { throw new Error("Verzending verboden"); });
    const row = { ...basis, is_test: true, extra_data: { handmatige_acceptatie: { bevestigd_op: "2026-10-22", geen_sepa_nodig: geenSepa } } };
    const result = await verstuurHandmatigeDocumenten(historieDb(), new Request("https://example.test"), row, "user", mail, { dryRun: true });
    expect(result.volgorde).toEqual(geenSepa ? ["certificaat", "mijnZp"] : ["certificaat", "sepa", "mijnZp"]);
    expect(mail).not.toHaveBeenCalled();
    expect(verstuurMachtigingBevestiging).not.toHaveBeenCalled();
    expect(autoInvitePortalLead).not.toHaveBeenCalled();
    console.log("Droog akkoord testlead:", JSON.stringify(result));
  });
  it("mislukte historiecontrole blokkeert vóór certificaat", async () => {
    const mail = vi.fn();
    await expect(verstuurHandmatigeDocumenten(historieDb({ error: true }), new Request("https://example.test"), basis, "user", mail)).rejects.toThrow("niets verstuurd");
    expect(mail).not.toHaveBeenCalled();
  });
  it("droge controle op echte lead wordt geweigerd", async () => {
    await expect(verstuurHandmatigeDocumenten({}, new Request("https://example.test"), basis, "user", vi.fn(), { dryRun: true })).rejects.toThrow("alleen voor testaanvragen");
  });
});