import { describe, it, expect } from "vitest";
import { mandaatkenmerkVoor } from "@/lib/sepaMachtiging";

// SEPA staat voor het mandaatkenmerk max. 35 tekens toe uit: A-Z a-z 0-9 / - ? : ( ) . , ' + en spatie.
const SEPA_TOEGESTAAN = /^[A-Za-z0-9/\-?:().,'+ ]+$/;

describe("mandaatkenmerk", () => {
  it("is max 35 tekens en alleen SEPA-toegestane tekens", () => {
    for (let i = 0; i < 200; i++) {
      const k = mandaatkenmerkVoor(crypto.randomUUID());
      expect(k.length).toBeLessThanOrEqual(35);
      expect(k).toMatch(SEPA_TOEGESTAAN);
      expect(k).toMatch(/^ZPZ[0-9A-F]{32}$/);
    }
  });
});
