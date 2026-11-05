// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const opslag = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => opslag.get(k) ?? null,
  setItem: (k: string, v: string) => void opslag.set(k, v),
  clear: () => opslag.clear(),
};
const loc = { pathname: "/offerte", hostname: "zpzaken.nl" };
const gtag = vi.fn();
const push = vi.fn();
(globalThis as Record<string, unknown>).localStorage = localStorage;
(globalThis as Record<string, unknown>).window = { location: loc, localStorage, gtag, uetq: { push } };

const t = await import("@/lib/tracking");
const adsConversies = () => gtag.mock.calls.filter((c) => c[1] === "conversion").map((c) => c[2].send_to);
const uetEvents = (naam: string) => push.mock.calls.filter((c) => c[0] === "event" && c[1] === naam);

describe("C8 secundaire meetpunten", () => {
  beforeEach(() => {
    gtag.mockReset(); push.mockReset(); localStorage.clear();
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: true }));
    loc.pathname = "/offerte";
    t.__resetUetVoorTest(true);
  });

  it("labels en send_to voor aanvraag gestart en offerte", () => {
    expect(t.GOOGLE_ADS_CONVERSIE_AANVRAAG_GESTART).toBe("EIoACNj547AdEOTnj_RE");
    expect(t.GOOGLE_ADS_CONVERSIE_OFFERTE).toBe("RU6KCOPajZ8dEOTnj_RE");
    expect(t.adsSendTo(t.GOOGLE_ADS_CONVERSIE_AANVRAAG_GESTART)).toBe("AW-18497139684/EIoACNj547AdEOTnj_RE");
    expect(t.adsSendTo(t.GOOGLE_ADS_CONVERSIE_OFFERTE)).toBe("AW-18497139684/RU6KCOPajZ8dEOTnj_RE");
  });

  it("offerte vuurt GA4, Ads en precies één UET-event", () => {
    t.trackOfferteVerzonden(false);
    expect(gtag.mock.calls.some((c) => c[1] === "offerte_verzonden")).toBe(true);
    expect(adsConversies()).toEqual(["AW-18497139684/RU6KCOPajZ8dEOTnj_RE"]);
    expect(uetEvents("offerte_verzonden")).toHaveLength(1);
  });

  it("offerte vuurt niets bij test of intern pad", () => {
    t.trackOfferteVerzonden(true);
    loc.pathname = "/admin/leads";
    t.trackOfferteVerzonden(false);
    expect(gtag).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("aanvraag gestart stuurt Ads-conversie één keer per concept", () => {
    loc.pathname = "/verzekeringen";
    t.trackAanvraagGestart("c-1", false);
    t.trackAanvraagGestart("c-1", false);
    expect(adsConversies()).toEqual(["AW-18497139684/EIoACNj547AdEOTnj_RE"]);
    t.trackAanvraagGestart("c-2", true);
    expect(adsConversies()).toHaveLength(1);
  });
});
