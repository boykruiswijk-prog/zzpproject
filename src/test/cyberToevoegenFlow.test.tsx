// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CyberToevoegen } from "@/components/portal/CyberToevoegen";
const mocks = vi.hoisted(() => ({ opties: [{ policy_id: "polis-1", label: "TEST-1", cyclus: "maand" }], rijen: [] as any[], rpc: vi.fn(), invoke: vi.fn(), mfa: true, zichtbaar: true }));
vi.mock("@/config/cyberToevoegen", () => ({ cyberToevoegenPreview: () => mocks.zichtbaar }));
vi.mock("@/hooks/useToonTestrecords", () => ({ useToonTestrecords: () => ({ toonTest: true }) }));
vi.mock("@/components/admin/ToonTestrecordsSchakelaar", () => ({ ToonTestrecordsSchakelaar: () => null }));
vi.mock("@/lib/adminMfaStap", () => ({ controleerAdminMfa: async () => mocks.mfa, verwerkMfaFout: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc,
  functions: { invoke: mocks.invoke },
  from: () => { const q = { select: () => q, order: () => q, eq: () => q, then: (r: any) => Promise.resolve({ data: mocks.rijen, error: null }).then(r) }; return q; },
} }));
function antwoorden() { for (const [id,v] of Object.entries({ a: false,b: true,c: true,d: true,e: false,f: false })) fireEvent.click(document.getElementById(`cyber-${id}-${v}`) as HTMLElement); }
describe("Cyberverzoek klant en team", () => {
  beforeEach(() => {
    cleanup(); mocks.rijen=[]; mocks.opties=[{ policy_id: "polis-1", label: "TEST-1", cyclus: "maand" }]; mocks.mfa=true; mocks.zichtbaar=true;
    mocks.invoke.mockReset(); mocks.invoke.mockImplementation(async (_fn: string, { body }: any) => {
      mocks.rijen[0].status = body.akkoord ? "akkoord_wacht_op_activatie" : "afgewezen";
      mocks.rijen[0].geactiveerd_op = body.akkoord ? "2026-10-23T12:00:00Z" : null;
      return { data: { status: body.akkoord ? "actief" : "afgewezen" }, error: null };
    });
    mocks.rpc.mockReset(); mocks.rpc.mockImplementation(async (fn: string,args: any) => {
      if (fn === "cyber_toevoegen_opties") return { data: mocks.opties, error: null };
      if (fn === "cyber_toevoegen_redenen") return { data: [], error: null };
      if (fn === "cyber_toevoegen_aanvragen") { mocks.rijen=[{ id:"verzoek-1",policy_id:"polis-1",status:"wacht_op_beoordeling",gewenste_ingangsdatum:args._ingang,antwoorden:args._antwoorden,bron:args._namens_klant ? "team":"klant" }]; return { data:"verzoek-1",error:null }; }
      if (fn === "cyber_toevoegen_beoordelen") { mocks.rijen[0].status=args._akkoord ? "akkoord_wacht_op_activatie":"afgewezen"; return { data:mocks.rijen[0].status,error:null }; }
      throw new Error("Unexpected activation or financial action");
    });
  });
  it.each([false, true])("uitgeschakelde toegang verbergt klant/team (%s) en leest geen verzoeken", async (team) => {
    mocks.zichtbaar = false;
    mocks.rijen = [{ id: "verzoek-1", status: "wacht_op_beoordeling" }];
    const { container } = render(<CyberToevoegen team={team} ondernemingId={team ? "ond-1" : undefined} />);
    await Promise.resolve();
    expect(container.childElementCount).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ongeschikte polis heeft geen toevoegenknop", async () => {
    mocks.opties=[]; render(<CyberToevoegen />); await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(screen.queryByRole("button",{name:"Cyber toevoegen"})).toBeNull();
  });
  it("zonder akkoord geen opslag, met akkoord alleen verzoek in beoordeling", async () => {
    render(<CyberToevoegen />); fireEvent.click(await screen.findByRole("button",{name:"Cyber toevoegen"})); antwoorden();
    fireEvent.click(screen.getByRole("button",{name:"Verzoek indienen"}));
    expect(mocks.rpc.mock.calls.filter(([f]) => f === "cyber_toevoegen_aanvragen")).toHaveLength(0);
    fireEvent.click(document.getElementById("cyber-later-akkoord") as HTMLElement);
    fireEvent.click(screen.getByRole("button",{name:"Verzoek indienen"}));
    await screen.findByText("Wacht op handmatige beoordeling");
    expect(mocks.rijen[0].status).toBe("wacht_op_beoordeling");
    expect(mocks.rpc.mock.calls.map(([f]) => f)).not.toContain("lead-to-exact-activate");
  });
  it("teamnotitie verplicht en MFA vereist vóór opslag", async () => {
    render(<CyberToevoegen team ondernemingId="ond-1" />); fireEvent.click(await screen.findByRole("button",{name:"Cyber toevoegen"})); antwoorden(); fireEvent.click(document.getElementById("cyber-later-akkoord") as HTMLElement);
    fireEvent.click(screen.getByRole("button",{name:"Verzoek indienen"})); expect(mocks.rpc.mock.calls.filter(([f]) => f === "cyber_toevoegen_aanvragen")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Notitie namens de klant"),{target:{value:"Klant heeft akkoord gegeven"}}); mocks.mfa=false;
    fireEvent.click(screen.getByRole("button",{name:"Verzoek indienen"})); await waitFor(() => expect(screen.getByRole("button",{name:"Verzoek indienen"})).not.toBeDisabled());
    expect(mocks.rpc.mock.calls.filter(([f]) => f === "cyber_toevoegen_aanvragen")).toHaveLength(0);
  });
  it.each([true,false])("beoordeling %s gebruikt de beveiligde cybercoördinator", async (keuze) => {
    mocks.rijen=[{ id:"verzoek-1",policy_id:"polis-1",status:"wacht_op_beoordeling",gewenste_ingangsdatum:"2026-10-24",antwoorden:{},bron:"klant" }];
    render(<CyberToevoegen team ondernemingId="ond-1" />);
    fireEvent.change(await screen.findByLabelText("Toelichting bij de beoordeling"),{target:{value:"Beoordeling door team vastgelegd"}});
    fireEvent.click(screen.getByRole("button",{name:keuze ? "Akkoord":"Afwijzen"}));
    await waitFor(() => expect(mocks.rijen[0].status).toBe(keuze ? "akkoord_wacht_op_activatie":"afgewezen"));
    expect(mocks.rpc.mock.calls.filter(([f]) => f !== "cyber_toevoegen_opties")).toEqual([]);
    expect(mocks.invoke).toHaveBeenCalledWith("cyber-toevoegen-activeren", { body: { id: "verzoek-1", akkoord: keuze, notitie: "Beoordeling door team vastgelegd" } });
    expect(Boolean(mocks.rijen[0].geactiveerd_op)).toBe(keuze);
  });
  it("definitieve mailfout kan alleen via een MFA-gecontroleerde klik worden herhaald", async () => {
    mocks.rijen = [{ id: "verzoek-1", status: "akkoord_wacht_op_activatie", geactiveerd_op: "2026-10-23", mail_status: "mail_mislukt", gewenste_ingangsdatum: "2026-10-24", antwoorden: {} }];
    render(<CyberToevoegen team ondernemingId="ond-1" />);
    const button = await screen.findByRole("button", { name: "Opnieuw versturen" });
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke.mock.calls[0][1].body.retryMail).toBe(true);
  });
  it("onzekere mail heeft geen herhaalknop", async () => {
    mocks.rijen = [{ id: "verzoek-1", status: "akkoord_wacht_op_activatie", geactiveerd_op: "2026-10-23", mail_status: "mail_onzeker", gewenste_ingangsdatum: "2026-10-24", antwoorden: {} }];
    render(<CyberToevoegen team ondernemingId="ond-1" />);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Opnieuw versturen" })).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});