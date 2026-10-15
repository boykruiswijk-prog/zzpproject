import { describe, it, expect, vi, beforeEach } from "vitest";
import { aanvraagStapParams, trackAanvraagStap } from "@/lib/tracking";

describe("GA4 aanvraag_stap", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });
  it("bevat alleen stap en stap_naam", () => {
    for (let stap = 1; stap <= 5; stap++) {
      const p = aanvraagStapParams(stap)!;
      expect(Object.keys(p).sort()).toEqual(["stap", "stap_naam"]);
      expect(p.stap).toBe(stap);
      expect(p.stap_naam).toMatch(/^[a-z]+$/);
    }
    expect(aanvraagStapParams(0)).toBeNull();
    expect(aanvraagStapParams(6)).toBeNull();
  });
  it("stuurt via gtag alleen de toegestane parameters", () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtag;
    trackAanvraagStap(3);
    expect(gtag).toHaveBeenCalledWith("event", "aanvraag_stap", { stap: 3, stap_naam: "gegevens" });
  });
  it("meet niet op interne paden", () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtag;
    window.history.pushState({}, "", "/admin");
    trackAanvraagStap(1);
    expect(gtag).not.toHaveBeenCalled();
  });
});
