import { describe, it, expect } from "vitest";
import { bouwAfgehaaktSamenvatting, herinneringStatus, type SamenvattingConcept } from "../../supabase/functions/_shared/nabellen";

const basis = (o: Partial<SamenvattingConcept>): SamenvattingConcept => ({
  id: "x", status: "open", is_test: false, lead_id: null, dubbel_lead_id: null, telefoon: "0687654321",
  email: "klant@bedrijf.nl", laatst_actief_op: "2026-11-03T07:00:00Z", team_gemeld_op: null, ...o,
});

describe("dagelijkse afhakerssamenvatting (besluit Boy 3-11)", () => {
  it("geen mail bij alleen testinvoer", () => {
    expect(bouwAfgehaaktSamenvatting([basis({ email: "test@test.nl" }), basis({ is_test: true })])).toBeNull();
  });
  it("sorteert op hoogste stap en telt testinvoer onderaan", () => {
    const m = bouwAfgehaaktSamenvatting([
      basis({ id: "a", voornaam: "Laag", max_stap: 2 }),
      basis({ id: "b", voornaam: "Hoog", max_stap: 4, herinnering_verstuurd_op: "2026-11-03T09:00:00Z" }),
      basis({ id: "c", telefoon: "0612345678" }),
    ])!;
    expect(m.aantal).toBe(2);
    expect(m.aantalTest).toBe(1);
    expect(m.text.indexOf("Hoog")).toBeLessThan(m.text.indexOf("Laag"));
    expect(m.text).toContain("Hoogste stap: 4 van 5");
    expect(m.text).toContain("Bedrijfsnaam: -");
    expect(m.text).toContain("Genegeerde testinvoer: 1");
    expect(m.text).toContain("https://zpzaken.nl/admin/afgehaakt?record=b");
  });
  it("herinneringsstatus", () => {
    expect(herinneringStatus(basis({ herinnering_verstuurd_op: "2026-11-03T09:00:00Z" }))).toBe("Herinnering verstuurd op 03-11-2026 10:00");
    expect(herinneringStatus(basis({ afhaak_geen_herinnering_reden: "afgemeld" }))).toBe("Geen herinnering: afgemeld");
    expect(herinneringStatus(basis({}))).toBe("Geen herinnering: nog niet aan de beurt, verwacht vanaf 03-11-2026 09:00");
  });
});
