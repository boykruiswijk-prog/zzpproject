// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BestaandeKlantAanvraag } from "@/components/admin/BestaandeKlantAanvraag";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), toast: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const bestaande = {
  onderneming_id: "c7f3e428-663a-4c53-a612-411990f120c0",
  naam: "TEST bestaande klant",
  contract_id: "contract-1",
  policy_id: "polis-1",
  polisnummer: "ZPBAVTEST1",
};

function renderKaart(lead: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><BestaandeKlantAanvraag lead={lead as any} /></QueryClientProvider>);
  return { client, view };
}

afterEach(() => {
  cleanup();
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
  mocks.toast.mockReset();
});

describe("dubbele aanvraag bij bestaande klant", () => {
  it("toont de bestaande polis en sluit alleen via de afzonderlijke afsluitroute", async () => {
    mocks.rpc.mockImplementation(async (naam: string) => {
      if (naam === "bestaande_klant_bij_aanvraag") return { data: bestaande, error: null };
      if (naam === "aanvraag_bestaande_klant_afsluiten") return { data: { ok: true }, error: null };
      throw new Error(`Onverwachte actie: ${naam}`);
    });
    const { client } = renderKaart({ id: "lead-1", type: "verzekering_aanvraag", status: "klant", geactiveerd_op: null, exact_invoice_id: null });

    expect(await screen.findByRole("alert")).toHaveTextContent("Bestaande klant: contract en polis lopen al (ZPBAVTEST1)");
    fireEvent.click(screen.getByRole("button", { name: "Afsluiten als bestaande klant" }));
    fireEvent.click(screen.getByRole("button", { name: "Bevestig afsluiten" }));

    await waitFor(() => expect(mocks.rpc.mock.calls.filter(([naam]) => naam === "aanvraag_bestaande_klant_afsluiten")).toHaveLength(1));
    expect(mocks.rpc).toHaveBeenCalledWith("aanvraag_bestaande_klant_afsluiten", { _lead_id: "lead-1" });
    expect(mocks.invoke).not.toHaveBeenCalled();
    client.clear();
  });

  it("blokkeert de knop als de aanvraag zelf al geactiveerd is", async () => {
    mocks.rpc.mockResolvedValue({ data: bestaande, error: null });
    const { client } = renderKaart({ id: "lead-2", type: "verzekering_aanvraag", status: "actief", geactiveerd_op: "2026-11-01", exact_invoice_id: null });

    const knop = await screen.findByRole("button", { name: "Afsluiten als bestaande klant" });
    expect(knop).toBeDisabled();
    fireEvent.click(knop);
    expect(mocks.rpc.mock.calls.map(([naam]) => naam)).not.toContain("aanvraag_bestaande_klant_afsluiten");
    client.clear();
  });

  it("toont na afsluiten de bestaande afsluitreden zonder een nieuwe actie", () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const { client } = renderKaart({ id: "lead-3", type: "verzekering_aanvraag", status: "samengevoegd", aanvraag_afgerond_reden: "Bestaande klant: polis ZPBAVTEST1 loopt al." });

    expect(screen.getByText("Afgesloten als bestaande klant")).toBeVisible();
    expect(screen.getByText("Bestaande klant: polis ZPBAVTEST1 loopt al.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Afsluiten als bestaande klant" })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
    client.clear();
  });
});
