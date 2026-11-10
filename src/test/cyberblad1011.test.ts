// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cyberCertificaatRijen } from "../../supabase/functions/_shared/cyberCertificaatTeksten";
const invoer = { certificaathouder: "Faasen Coaching", verzekeringsnemer: "Faasen Coaching", bav_certificaatnummer: "", cyber_certificaatnummer: "ZPCYB0001", cyber_ingangsdatum: "2026-11-10", afgiftedatum: "2026-11-10", voor_gezien: "Ellen Baars" };
describe("CYBERBLAD certificaatbedragen", () => {
  for (const [cyclus, premie] of [["maand", "EUR 27,50 per maand"], ["jaar", "EUR 250 per jaar"]] as const) {
    it(`premie ${cyclus}`, () => expect(cyberCertificaatRijen({ ...invoer, betaalcyclus: cyclus }).find(r => r.label === "Premie:")?.waarde).toBe(premie));
  }
  it("cyberfraude eigen risico 1000", () => expect(cyberCertificaatRijen(invoer).find(r => r.label === "Eigen risico:")?.waarde).toBe("EUR 500 per schade, bij cyberfraude EUR 1.000"));
  it("hulp 72 uur tot 15000 zonder eigen risico", () => expect(cyberCertificaatRijen(invoer).find(r => r.label === "Hulp bij incident:")?.waarde).toBe("Kosten in de eerste 72 uur tot EUR 15.000, zonder eigen risico."));
  it("dekking 50000", () => expect(cyberCertificaatRijen(invoer).find(r => r.label === "Verzekerd bedrag:")?.waarde).toContain("EUR 50.000 per schade"));
  it("nummer en geen dagelijkse cyberopzegzin", () => {
    const r = cyberCertificaatRijen(invoer);
    expect(r.find(r => r.label === "Certificaatnummer:")?.waarde).toBe("ZPCYB0001");
    expect(r.find(r => r.label === "Contractduur:")?.waarde).not.toMatch(/cyber.{0,10}dagelijks opzegbaar/i);
  });
});