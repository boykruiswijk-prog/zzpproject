// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cyberGateBesluit } from "../../supabase/functions/_shared/cyberAlleenTest";
describe("E4 alleen_test gate", () => {
  it("menselijke MFA op testpolis dwingt droge modus af", () => {
    expect(cyberGateBesluit({ actief: false, modus: "alleen_test" }, true, true)).toEqual({ toegestaan: true, droog: true, reden: "" });
  });
  it("weigert echte polissen ook bij MFA", () => {
    expect(cyberGateBesluit({ actief: false, modus: "alleen_test" }, false, true).toegestaan).toBe(false);
  });
  it("service-identiteit vervangt de menselijke MFA niet", () => {
    expect(cyberGateBesluit({ actief: false, modus: "alleen_test" }, true, false).toegestaan).toBe(false);
  });
  it("ontbrekende configuratie laat echte activatie niet door", () => {
    expect(cyberGateBesluit(null, false, true).toegestaan).toBe(false);
  });
});