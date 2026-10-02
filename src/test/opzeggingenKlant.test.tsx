// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const aanvraag = {
  id: "a1", created_at: "2026-09-28T10:00:00Z", voornaam: "Jan", achternaam: "Jansen",
  email: "jan@example.nl", telefoon: "0612345678", polisnummer: "ZPBAV1234",
  details: { opzegdatum: "2026-11-30", reden: "Anders", toelichting: "Gestopt met ondernemen", bedrijfsnaam: "Jansen BV" },
  notities: "Bellen voor bevestiging", koppeling_status: "zeker", koppeling_methode: "email", koppeling_details: null,
  onderneming_id: "o1", opzegging_verwerkt_op: "2026-09-29T12:00:00Z", opzegging_verwerkt_door: "u1", is_test: false,
};
const credit = { aanvraag_id: "a1", klant_contract_id: "c1", status: "concept_aangemaakt", melding: null, bedrag: 542.96, credit_vanaf: "2026-10-03", credit_tm: "2027-10-04", bron: "oud_systeem" };

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: unknown[]) => from(...a) } }));
vi.mock("@/hooks/useToonTestrecords", () => ({ useToonTestrecords: () => ({ toonTest: true, magSchakelen: true, zet: () => {} }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }) }));

import { OpzeggingenKlant, CREDIT_STATUS_LABEL } from "@/components/admin/OpzeggingenKlant";

function mockFrom() {
  from.mockImplementation((tabel: string) => {
    if (tabel === "klant_service_aanvragen") {
      return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [aanvraag], error: null }) }) }) }) };
    }
    if (tabel === "factuur_credit_planning") {
      return { select: () => ({ in: async () => ({ data: [credit], error: null }) }) };
    }
    if (tabel === "profiles") {
      return { select: () => ({ in: async () => ({ data: [{ id: "u1", full_name: "Roxy Test" }], error: null }) }) };
    }
    throw new Error("onverwachte tabel " + tabel);
  });
}

function renderBlok() {
  return render(<MemoryRouter><OpzeggingenKlant ondernemingId="o1" contracten={[]} onGewijzigd={() => {}} /></MemoryRouter>);
}

describe("OpzeggingenKlant details", () => {
  beforeEach(() => { from.mockReset(); mockFrom(); });

  it("toont alle ingevulde gegevens na klik op Details (ook voor rol verzekering: zelfde leesrechten als het blok)", async () => {
    renderBlok();
    fireEvent.click(await screen.findByRole("button", { name: "Details" }));
    expect(await screen.findByText("Jansen BV")).toBeTruthy();
    expect(screen.getByText("jan@example.nl").closest("a")?.getAttribute("href")).toBe("mailto:jan@example.nl");
    expect(screen.getByText("0612345678").closest("a")?.getAttribute("href")).toBe("tel:0612345678");
    expect(screen.getByText("ZPBAV1234")).toBeTruthy();
    expect(screen.getByText("Gestopt met ondernemen")).toBeTruthy();
    expect(screen.getByText("Bellen voor bevestiging")).toBeTruthy();
    expect(screen.getByText("Bekijk de volledige aanvraag").closest("a")?.getAttribute("href")).toBe("/admin/service-aanvragen/a1");
  });

  it("toont na verwerking de creditnota-status, het bedrag en de periode", async () => {
    renderBlok();
    fireEvent.click(await screen.findByRole("button", { name: "Details" }));
    expect(await screen.findByText(/Verwerkt op .* door Roxy Test/)).toBeTruthy();
    expect(screen.getByText("Concept in Exact")).toBeTruthy();
    expect(screen.getByText(/542,96/)).toBeTruthy();
    expect(screen.getByText(/periode .* t/m/)).toBeTruthy();
  });

  it("kent labels voor alle creditstatussen", () => {
    for (const s of ["te_maken", "geblokkeerd", "concept_aangemaakt", "verwerkt"]) expect(CREDIT_STATUS_LABEL[s]).toBeTruthy();
  });
});
