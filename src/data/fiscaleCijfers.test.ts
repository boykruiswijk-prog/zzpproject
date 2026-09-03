import { describe, expect, it } from "vitest";
import {
  ALGEMENE_HEFFINGSKORTING,
  ARBEIDSKORTING,
  berekenAlgemeneHeffingskorting,
  berekenArbeidskorting,
  fiscaleCijfers,
} from "./fiscaleCijfers";

describe("arbeidskorting 2026", () => {
  it("is gelijk aan het maximum bij een arbeidsinkomen van 45.592 euro", () => {
    expect(berekenArbeidskorting(45592)).toBe(fiscaleCijfers.maximaleArbeidskorting.waarde);
    expect(berekenArbeidskorting(45592)).toBe(5685);
  });

  it("bouwt op in de eerste schijf en af boven het maximum", () => {
    expect(berekenArbeidskorting(11965)).toBe(996);
    expect(berekenArbeidskorting(132921)).toBe(0);
  });

  it("dekt het hele inkomensbereik zonder gaten", () => {
    const s = ARBEIDSKORTING.schijven;
    for (let i = 1; i < s.length; i++) {
      expect(s[i].van).toBe((s[i - 1].totEnMet as number) + 1);
    }
  });
});

describe("algemene heffingskorting 2026", () => {
  it("is gelijk aan het maximum bij een inkomen van 29.736 euro", () => {
    expect(berekenAlgemeneHeffingskorting(29736)).toBe(
      fiscaleCijfers.maximaleAlgemeneHeffingskorting.waarde,
    );
    expect(berekenAlgemeneHeffingskorting(29736)).toBe(3115);
  });

  it("is nul vanaf 78.427 euro", () => {
    expect(berekenAlgemeneHeffingskorting(78427)).toBe(0);
    expect(berekenAlgemeneHeffingskorting(120000)).toBe(0);
  });

  it("dekt het hele inkomensbereik zonder gaten", () => {
    const s = ALGEMENE_HEFFINGSKORTING.schijven;
    for (let i = 1; i < s.length; i++) {
      expect(s[i].van).toBe((s[i - 1].totEnMet as number) + 1);
    }
  });
});
