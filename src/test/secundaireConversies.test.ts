// @vitest-environment node
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
      ["event", "conversion", { send_to: "AW-18497139684/NMSZCIao65wdEOTnj_RE" }],
      ["event", "contactformulier_verzonden", { formulier: "contact", page: "/contact" }],
      ["event", "conversion", { send_to: "AW-18497139684/Z5lyCN2R85wdEOTnj_RE" }],
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

  it("lege en ongeldige labels geven alleen GA4, nooit een accountconversie", () => {
    for (const label of ["", "kort", "ongeldig/label", " spaties12345"]) {
      expect(t.adsSendTo(label)).toBeNull();
      t.secundaireConversie("contactformulier_verzonden", "contact", label, false);
    }
    expect(gtag.mock.calls).toHaveLength(4);
    expect(gtag.mock.calls.every(c => c[1] === "contactformulier_verzonden")).toBe(true);
    expect(gtag.mock.calls.some(c => c[2]?.send_to === t.GOOGLE_ADS_ID)).toBe(false);
  });

  it("tv, scherm, admin en testomgeving versturen niets", () => {
    for (const pad of ["/tv", "/scherm", "/admin", "/en/tv"]) {
      loc.pathname = pad;
      t.trackTerugbelVerzonden(false);
      t.trackContactVerzonden(false);
    }
    loc.pathname = "/contact";
    loc.hostname = "id-preview--x.lovable.app";
    t.trackContactVerzonden();
    t.trackTerugbelVerzonden();
    loc.hostname = "zpzaken.nl";
    expect(gtag).not.toHaveBeenCalled();
  });

  it("primaire conversie ongewijzigd", () => {
    expect(t.GOOGLE_ADS_CONVERSIE).toBe("AW-18497139684/rIoQCIid-5IdEOTnj_RE");
    const src = fs.readFileSync(path.resolve(__dirname, "../lib/tracking.ts"), "utf8");
    expect(src).toContain('trackGa("conversion", {\n    send_to: GOOGLE_ADS_CONVERSIE,\n    value,\n    currency: "EUR",\n    transaction_id: transactionId,\n  });');
    expect(src).toContain('adsSendTo(GOOGLE_ADS_CONVERSIE.split("/")[1] ?? "") === GOOGLE_ADS_CONVERSIE');
  });
});
