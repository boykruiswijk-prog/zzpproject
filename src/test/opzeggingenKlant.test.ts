import { describe, it, expect } from "vitest";
import { CREDIT_STATUS_LABEL, creditStatusTekst, type CreditInfo } from "@/components/admin/OpzeggingenKlant";

const basis: CreditInfo = { klant_contract_id: "c1", status: "concept_aangemaakt", melding: null, bedrag: 542.96, credit_vanaf: "2026-10-03", credit_tm: "2027-10-04", bron: "oud_systeem" };

describe("creditStatusTekst", () => {
  it("kent labels voor alle creditstatussen", () => {
    for (const s of ["te_maken", "geblokkeerd", "concept_aangemaakt", "verwerkt", "geen_planner_factuur", "niet_nodig"]) {
      expect(CREDIT_STATUS_LABEL[s]).toBeTruthy();
    }
  });

  it("toont status, bedrag en periode na verwerking", () => {
    const t = creditStatusTekst(basis);
    expect(t).toContain("Concept in Exact");
    expect(t).toContain("542,96");
    expect(t).toContain("periode");
    expect(t).toContain("t/m");
  });

  it("toont de reden bij een geblokkeerde creditnota", () => {
    const t = creditStatusTekst({ ...basis, status: "geblokkeerd", melding: "Geen bevestigde artikelmapping" });
    expect(t).toContain("Geblokkeerd");
    expect(t).toContain("Geen bevestigde artikelmapping");
  });

  it("laat bedrag en periode weg als ze ontbreken", () => {
    const t = creditStatusTekst({ ...basis, status: "te_maken", bedrag: null, credit_vanaf: null, credit_tm: null });
    expect(t).toBe("Te maken");
  });
});
