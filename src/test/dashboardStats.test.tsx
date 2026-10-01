// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useToonTestrecords", () => ({ useToonTestrecords: () => ({ toonTest: false, magSchakelen: true, zet: () => {} }) }));

import { DashboardStats } from "@/components/admin/DashboardStats";

function renderStats() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MemoryRouter><DashboardStats /></MemoryRouter></QueryClientProvider>,
  );
}

describe("DashboardStats", () => {
  beforeEach(() => rpc.mockReset());

  it("toont de getallen uit dashboard_tellers", async () => {
    rpc.mockResolvedValue({ data: {
      klanten: 849, contracten_actief: 1105, mrr: 42222.47, arr: 506669.64,
      leads_totaal: 4, leads_week: 1, leads_maand: 3, leads_omgezet: 2,
      opzeggingen_te_koppelen: 5, opzeggingen_te_verwerken: 1,
      planning_aantal: 71, planning_bedrag: 9793, planning_factureerbaar_aantal: 0,
      planning_factureerbaar_bedrag: 0, planning_geblokkeerd_aantal: 71,
    }, error: null });
    renderStats();
    expect(await screen.findByText("849")).toBeTruthy();
    expect(screen.getByText("1105")).toBeTruthy();
    expect(screen.getByText(/42\.222,47/)).toBeTruthy();
    expect(screen.getByText(/506\.669,64/)).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText(/^71 ·/)).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("dashboard_tellers", { _toon_test: false });
  });

  it("toont een foutmelding met opnieuw proberen", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "geen toegang" } });
    renderStats();
    await waitFor(() => expect(screen.getByText("Tellers konden niet worden geladen")).toBeTruthy());
    expect(screen.getByText("geen toegang")).toBeTruthy();
    expect(screen.getByRole("button", { name: /opnieuw proberen/i })).toBeTruthy();
  });
});
