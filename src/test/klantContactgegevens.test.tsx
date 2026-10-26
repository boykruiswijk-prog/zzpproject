import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { KlantKaart } from "@/components/admin/crm/KlantKaart";
import { klantContactwaarden, laadKlantContactgegevens } from "@/lib/klantContactgegevens";

const store = vi.hoisted(() => ({
  bedrijven: [{ id: "oud", samengevoegd_naar: "nieuw" }, { id: "nieuw", naam: "TEST contactkaart", samengevoegd_naar: null }],
  koppelingen: [{ onderneming_id: "nieuw", persoon_id: "persoon" }],
  personen: [{ id: "persoon", voornaam: "Test", achternaam: "Contact", email_weergave: "contacttest@zpzaken.nl", telefoon: null as string | null }],
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (tabel: string) => {
    let rows: Record<string, unknown>[] = tabel === "ondernemingen" ? store.bedrijven : tabel === "persoon_onderneming" ? store.koppelingen : tabel === "personen" ? store.personen : [];
    const api: any = {
      select: () => api,
      in: (key: string, ids: string[]) => { rows = rows.filter((r) => ids.includes(String(r[key]))); return api; },
      eq: (key: string, value: string) => { rows = rows.filter((r) => r[key] === value); return api; },
      order: () => api, is: () => api, or: () => api, limit: () => api,
      maybeSingle: async () => ({ data: rows[0] ? { ...rows[0] } : null, error: null }),
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows.map((r) => ({ ...r })), error: null }).then(resolve),
    };
    return api;
  },
  rpc: store.rpc,
} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isSupervisorOrAdmin: true, isVerzekering: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/usePdokAdres", () => ({ zoekPdokAdres: vi.fn() }));
vi.mock("@/lib/bavNummer", () => ({ useBavRijen: () => ({ data: [] }), kiesBavNummer: () => null, contractEindStatus: () => ({ soort: "lopend" }) }));
vi.mock("@/components/admin/crm/BavNummer", () => ({ BavNummer: () => null }));
vi.mock("@/components/admin/crm/PortalUitnodigen", () => ({ PortalUitnodigen: () => null }));
vi.mock("@/components/admin/crm/DocumentVersturen", () => ({ DocumentVersturen: () => null }));
vi.mock("@/components/admin/incasso/Incasso", () => ({ IncassoKlantBlok: () => null }));
vi.mock("@/components/admin/CyberDatums", () => ({ CyberDatums: () => null }));
vi.mock("@/components/admin/IbanInzien", () => ({ IbanInzien: () => null }));

afterEach(() => { cleanup(); store.personen[0].telefoon = null; store.personen[0].email_weergave = "contacttest@zpzaken.nl"; store.rpc.mockReset(); });

describe("klantkaart contactbron", () => {
  it("wijzigt telefoon en e-mail op de persoon en toont opgeslagen waarden, ook via een samengevoegde kaart", async () => {
    store.rpc.mockImplementation(async (naam, args) => {
      expect(naam).toBe("crm_gegevens_wijzigen");
      expect(args._onderneming_id).toBe("nieuw");
      expect(args._persoon_id).toBe("persoon");
      store.personen[0].telefoon = args._wijzigingen.telefoon;
      store.personen[0].email_weergave = args._wijzigingen.email_weergave;
      return { data: {}, error: null };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const kaart = () => <QueryClientProvider client={client}><MemoryRouter><KlantKaart ondernemingen={[{ id: "oud", naam: "TEST contactkaart" }]} personen={[]} leadIds={[]} /></MemoryRouter></QueryClientProvider>;
    const view = render(kaart());
    fireEvent.click(await screen.findByRole("button", { name: "Gegevens wijzigen" }));
    const invoer = await screen.findByLabelText("Telefoon");
    await waitFor(() => expect(screen.getByLabelText("E-mail")).toHaveValue("contacttest@zpzaken.nl"));
    fireEvent.change(invoer, { target: { value: "0612345678" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "gewijzigd@zpzaken.nl" } });
    fireEvent.click(screen.getByRole("button", { name: /^Opslaan$/ }));
    const link = await screen.findByRole("link", { name: "0612345678" });
    expect(link).toHaveAttribute("href", "tel:0612345678");
    expect(await screen.findByRole("link", { name: "gewijzigd@zpzaken.nl" })).toHaveAttribute("href", "mailto:gewijzigd@zpzaken.nl");
    expect(store.rpc).toHaveBeenCalledTimes(1);
    view.unmount();
    client.clear();
    render(kaart());
    expect(await screen.findByRole("link", { name: "0612345678" })).toHaveAttribute("href", "tel:0612345678");
  });

  it("personen zijn leidend boven verouderde lead-contactgegevens", () => {
    const waarden = klantContactwaarden([{ ...store.personen[0], telefoon: "0631303623" }], [{ telefoon: "0699999999", email: "oud@zpzaken.nl" }]);
    expect(waarden.telefoons).toEqual(["0631303623"]);
    expect(waarden.emails).toEqual(["contacttest@zpzaken.nl"]);
  });

  it("legacy zonder persoon behoudt leadtelefoon en e-mail", () => {
    expect(klantContactwaarden([], [{ telefoon: "0611111111", email: "legacy@zpzaken.nl" }])).toEqual({ telefoons: ["0611111111"], emails: ["legacy@zpzaken.nl"] });
  });

  it("leeg gemaakte persoonstelefoon haalt geen oud leadnummer terug", () => {
    expect(klantContactwaarden(store.personen, [{ telefoon: "0699999999" }]).telefoons).toEqual([]);
  });

  it("oude en hoofdkaart samen leveren één contactpersoon op", async () => {
    const contact = await laadKlantContactgegevens(["oud", "nieuw"], []);
    expect(contact.personen.map((p) => p.id)).toEqual(["persoon"]);
    expect(contact.canoniek.get("oud")).toBe("nieuw");
  });

  it("leest het opgeslagen telefoonnummer ook als de ouderpagina een verouderde persoon zonder telefoon doorgeeft", async () => {
    store.personen[0].telefoon = "0611317783";
    const contact = await laadKlantContactgegevens(["nieuw"], ["persoon"]);
    expect(klantContactwaarden(contact.personen, []).telefoons).toEqual(["0611317783"]);
  });
});