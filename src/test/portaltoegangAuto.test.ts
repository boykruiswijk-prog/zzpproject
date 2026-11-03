import { describe, it, expect } from "vitest";
import { binnenMisbruikrem, MAX_UITNODIGINGEN_PER_24U } from "../../supabase/functions/_shared/portaltoegangAuto";

describe("automatische portaltoegang: misbruikrem", () => {
  it("maximaal 3 uitnodigingen per adres per 24 uur", () => {
    expect(MAX_UITNODIGINGEN_PER_24U).toBe(3);
    expect(binnenMisbruikrem(2)).toBe(true);
    expect(binnenMisbruikrem(3)).toBe(false);
  });
});
