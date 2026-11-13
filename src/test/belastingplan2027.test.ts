import { describe, it, expect } from "vitest";
import { resolveFiscaleTokens } from "@/lib/fiscaleTokens";
import { fiscaleCijfers } from "@/data/fiscaleCijfers";

describe("Belastingplan 2027 bedragen uit de centrale lijst", () => {
  it("startersaftrek 2026 is 2.123 euro en 2027 aangekondigd 10 euro met wetsvoorstel als bron", () => {
    expect(fiscaleCijfers.startersaftrek.waarde).toBe(2123);
    expect(fiscaleCijfers.startersaftrek.aangekondigd[2027]).toBe(10);
    expect(fiscaleCijfers.startersaftrek.aangekondigdBron.url).toContain("rijksoverheid.nl");
  });
  it("tokens tonen bedragen als lopende tekst", () => {
    expect(resolveFiscaleTokens("{{fiscaal:zelfstandigenaftrek:euro}}")).toBe("1.200 euro");
    expect(resolveFiscaleTokens("{{fiscaal:zelfstandigenaftrek:2027_euro}}")).toBe("900 euro");
    expect(resolveFiscaleTokens("{{fiscaal:startersaftrek:euro}}")).toBe("2.123 euro");
    expect(resolveFiscaleTokens("{{fiscaal:startersaftrek:2027_euro}}")).toBe("10 euro");
  });
  it("onbekend jaar blijft zichtbaar als token", () => {
    expect(resolveFiscaleTokens("{{fiscaal:startersaftrek:2031_euro}}")).toBe("{{fiscaal:startersaftrek:2031_euro}}");
  });
});
