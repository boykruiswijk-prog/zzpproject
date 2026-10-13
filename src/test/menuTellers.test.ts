// @vitest-environment node
import { describe, it, expect } from "vitest";
import { tellerUitleg, groepsTotaal, groepsDoel, TELLER_DOEL } from "@/lib/menuTellers";
import { magHandmatigAfhandelen } from "@/lib/creditHandmatig";

const t = { aanvragen: 2, bav_nakijken: 330, klanten: 12, klanten_credits: 12, klanten_credits_oud: 10, klanten_taken: 0 };
describe("rode tellers", () => {
  it("BAV-nummer nakijken telt niet mee in het groepstotaal", () => {
    expect(groepsTotaal(["aanvragen", "bav_nakijken"], t)).toBe(2);
    expect(groepsDoel(["bav_nakijken", "aanvragen"], t)).toBe("/admin/aanvragen");
  });
  it("uitleg klanten noemt de vastgelopen creditnota's", () => {
    expect(tellerUitleg("klanten", t)).toBe("12 creditnota's lopen vast: 10 uit het oude systeem, 2 zonder Exact-koppeling of artikel");
    expect(TELLER_DOEL.klanten).toBe("/admin/klanten#creditnotas");
  });
  it("knop handmatig afgehandeld alleen voor open oud-systeem creditnota's", () => {
    const m = "oorspronkelijk gefactureerd vóór 13-10-2026 (oud systeem)";
    expect(magHandmatigAfhandelen({ status: "fout", melding: m })).toBe(true);
    expect(magHandmatigAfhandelen({ status: "niet_crediteren", melding: m })).toBe(false);
    expect(magHandmatigAfhandelen({ status: "geblokkeerd", melding: "relatie niet gekoppeld aan Exact" })).toBe(false);
  });
});
