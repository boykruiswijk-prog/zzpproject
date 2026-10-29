// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { bouwSchermPayload, liveDoelTekst } from "../../supabase/functions/_shared/schermAnonimiseer";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useToonTestrecords", () => ({ useToonTestrecords: () => ({ toonTest: false, magSchakelen: true, zet: () => {} }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isSupervisorOrAdmin: false, isAal2: true, user: { id: "team" } }) }));

import { DashboardStats } from "@/components/admin/DashboardStats";
import { IbanInzien, maskeerIbanVol } from "@/components/admin/IbanInzien";
import { serviceAanvraagAfronden } from "@/lib/serviceAanvraag";

const migratie = readFileSync("drizzle/migrations/0116_een_bron_tellers_service_iban.sql", "utf8");

describe("Eén bron voor aantallen", () => {
  beforeEach(() => rpc.mockReset());

  it("dashboard_tellers en scherm_data gebruiken dezelfde telfuncties", () => {
    for (const f of ["tel_klanten", "tel_contracten", "tel_service_open", "tel_aanvragen_doel"]) {
      expect(migratie).toContain(`CREATE OR REPLACE FUNCTION public.${f}(`);
    }
    // dashboard
    expect(migratie).toMatch(/'klanten'', public\.tel_klanten\(_toon_test\)/);
    expect(migratie).toMatch(/'contracten_actief'', public\.tel_contracten\(_toon_test\)/);
    expect(migratie).toMatch(/'service_open'', public\.tel_service_open\(_toon_test\)/);
    // scherm
    expect(migratie).toMatch(/'actieve_klanten'', public\.tel_klanten\(false\)/);
    expect(migratie).toMatch(/'actieve_contracten'', public\.tel_contracten\(false\)/);
    expect(migratie).toMatch(/'open'', public\.tel_service_open\(false\)/);
    expect(migratie).toMatch(/'totaal'', public\.tel_aanvragen_doel\(v_start\)/);
  });

  it("voor dezelfde dataset tonen dashboard en scherm dezelfde getallen", async () => {
    // Dataset zoals de telfuncties die op 12 okt teruggaven.
    const set = { klanten: 851, contracten: 1107, service: 1, aanvragen: 5 };
    rpc.mockResolvedValue({ data: { klanten: set.klanten, contracten_actief: set.contracten, mrr: 0, arr: 0, leads_totaal: 0, leads_week: 0, leads_maand: 0, leads_omgezet: 0,
      opzeggingen_te_koppelen: 0, opzeggingen_te_verwerken: 0, planning_aantal: null, planning_bedrag: null, planning_factureerbaar_aantal: null, planning_factureerbaar_bedrag: null,
      planning_geblokkeerd_aantal: null, service_open: set.service, aanvragen_doel: set.aanvragen, aanvragen_doel_van: 200 }, error: null });
    const scherm = bouwSchermPayload({ klantbasis: { actieve_klanten: set.klanten, actieve_contracten: set.contracten }, service: { open: set.service }, doel: { totaal: set.aanvragen } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><MemoryRouter><DashboardStats /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText(`${scherm.doel.totaal} van 200`)).toBeTruthy());
    expect(screen.getByText(String(scherm.klantbasis.actieve_klanten))).toBeTruthy();
    expect(screen.getByText(String(scherm.klantbasis.actieve_contracten))).toBeTruthy();
    expect(scherm.service.open).toBe(set.service);
  });

  it("AI-team gebruikt het live doelaantal, nooit het getal uit marketing_snapshot", () => {
    expect(liveDoelTekst("3 van 200 aanvragen binnen", 5)).toBe("5 van 200 aanvragen binnen");
    const p = bouwSchermPayload({ doel: { totaal: 7 }, marketing: { ai_team: { dag: "2026-10-12", data: { agents: [{ naam: "Groei", taak: "doel", resultaat: "3 van 200 aanvragen", status: "klaar" }] } } } });
    expect(p.ai_team.find(a => a.naam === "Groei")?.resultaat).toBe("7 van 200 aanvragen");
  });
});

describe("Serviceaanvraag afronden", () => {
  beforeEach(() => rpc.mockReset());
  it("meldt een fout als er niets is bijgewerkt", async () => {
    rpc.mockResolvedValue({ data: { bijgewerkt: 0 }, error: null });
    await expect(serviceAanvraagAfronden("x")).rejects.toThrow(/niets bijgewerkt/);
  });
  it("geeft de RPC-fout door (bijv. geen toegang)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "geen toegang" } });
    await expect(serviceAanvraagAfronden("x")).rejects.toThrow("geen toegang");
  });
  it("lukt alleen via de RPC", async () => {
    rpc.mockResolvedValue({ data: { bijgewerkt: 1 }, error: null });
    await serviceAanvraagAfronden("abc");
    expect(rpc).toHaveBeenCalledWith("service_aanvraag_afronden", { _id: "abc" });
  });
});

describe("IBAN intern", () => {
  beforeEach(() => rpc.mockReset());
  it("is standaard gemaskeerd en toont pas na klikken via de RPC", async () => {
    rpc.mockResolvedValue({ data: { iban: "NL91ABNA0417164300", oud: null, nieuw: null }, error: null });
    render(<IbanInzien bron="onderneming" id="o1" gemaskeerd="NL91ABNA0417164300" />);
    expect(screen.getByText("NL** **** **** 4300")).toBeTruthy();
    expect(screen.queryByText(/ABNA/)).toBeNull();
    fireEvent.click(screen.getByText("Toon IBAN"));
    await waitFor(() => expect(screen.getByText("NL91 ABNA 0417 1643 00")).toBeTruthy());
    expect(rpc).toHaveBeenCalledWith("iban_inzien", { _bron: "onderneming", _id: "o1" });
  });
  it("RPC alleen voor teamrollen met 2FA, nooit voor anon, en logt elke inzage", () => {
    expect(migratie).toMatch(/REVOKE ALL ON FUNCTION public\.iban_inzien\(text, uuid\) FROM PUBLIC, anon/);
    const fn = migratie.slice(migratie.indexOf("FUNCTION public.iban_inzien"));
    expect(fn).toMatch(/is_supervisor_or_admin\(auth\.uid\(\)\) OR public\.has_role\(auth\.uid\(\),'verzekering'::app_role\)\) AND coalesce\(auth\.jwt\(\)->>'aal',''\) = 'aal2'/);
    expect(fn).toContain("'iban_ingezien'");
  });
  it("maskeert altijd tot landcode en laatste 4", () => {
    expect(maskeerIbanVol("nl91 abna 0417 1643 00")).toBe("NL** **** **** 4300");
    expect(maskeerIbanVol(null)).toBe("-");
  });
  it("scherm-payload bevat nooit een IBAN", () => {
    const p = JSON.stringify(bouwSchermPayload({ activiteit: [{ id: "1", station: "service", tekst: "NL91ABNA0417164300", status: "klaar", tijd: "2026-10-12T08:00:00Z" }] }));
    expect(p).not.toMatch(/NL\d{2}[A-Z]{4}\d{10}/);
  });
});
