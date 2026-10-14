// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const loc = { pathname: "/contact", hostname: "zpzaken.nl" };
const gtag = vi.fn();
(globalThis as Record<string, unknown>).window = { location: loc, gtag };

const t = await import("@/lib/tracking");

describe("secundaire conversies", () => {
  beforeEach(() => { gtag.mockReset(); loc.pathname = "/contact"; });

  it("terugbel en contact sturen GA4-event en Ads-conversie zonder persoonsgegevens", () => {
    t.trackTerugbelVerzonden(false);
    t.trackContactVerzonden(false);
    expect(gtag.mock.calls).toEqual([
      ["event", "terugbelverzoek_verzonden", { formulier: "terugbel", page: "/contact" }],
      ["event", "conversion", { send_to: t.GOOGLE_ADS_CONVERSIE_TERUGBEL || "AW-18497139684" }],
      ["event", "contactformulier_verzonden", { formulier: "contact", page: "/contact" }],
      ["event", "conversion", { send_to: t.GOOGLE_ADS_CONVERSIE_CONTACT || "AW-18497139684" }],
    ]);
  });

  it("vuurt niet op /admin en niet bij testinzendingen", () => {
    loc.pathname = "/admin/leads";
    t.trackTerugbelVerzonden(false);
    t.trackContactVerzonden(false);
    loc.pathname = "/contact";
    t.trackTerugbelVerzonden(true);
    t.trackContactVerzonden(true);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("preview-domein telt als test", () => {
    expect(t.isTestOmgeving("id-preview--x.lovable.app")).toBe(true);
    expect(t.isTestOmgeving("www.zpzaken.nl")).toBe(false);
  });

  it("primaire conversie ongewijzigd", () => {
    expect(t.GOOGLE_ADS_CONVERSIE).toBe("AW-18497139684/rIoQCIid-5IdEOTnj_RE");
    const src = fs.readFileSync(path.resolve(__dirname, "../lib/tracking.ts"), "utf8");
    expect(src).toContain('trackGa("conversion", {\n    send_to: GOOGLE_ADS_CONVERSIE,\n    value,\n    currency: "EUR",\n    transaction_id: transactionId,\n  });');
  });
});
