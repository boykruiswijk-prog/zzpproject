// @vitest-environment node
import { describe, it, expect } from "vitest";
import { maskeerIbanKaart } from "@/components/admin/IbanInzien";
describe("maskeerIbanKaart", () => {
  it("toont NL12 ABCD **** 1234", () => {
    expect(maskeerIbanKaart("nl91 abna 0417 1643 00")).toBe("NL91 ABNA **** 4300");
  });
  it("geeft geen middendeel prijs en verwerkt leeg", () => {
    const m = maskeerIbanKaart("NL91ABNA0417164300");
    expect(m).not.toContain("041716");
    expect(maskeerIbanKaart(null)).toBe("-");
    expect(maskeerIbanKaart("NL91")).toBe("****");
  });
});
