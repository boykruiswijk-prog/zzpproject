import { describe, it, expect } from "vitest";
import { seoRoutes } from "../config/seoRoutes";
import { formatPageTitle } from "../lib/seoTitle";
import { EVI_PAGINA_PAD } from "../config/eviPagina";

const BRANDING = new Set(["zp zaken", "zpzaken", "zpzaken.nl", "kennisbank"]);

describe("SEO-titels", () => {
  it.each(seoRoutes.map((r) => [r.path, r.title]))("%s wordt niet afgekapt", (_path, title) => {
    if (_path === EVI_PAGINA_PAD) {
      // F7: deze expliciet opgegeven titel wordt exact gebruikt, zonder formatter.
      expect(title).toBe("Pensioen opbouwen als zzp'er in 2026 | Jaarruimte en lijfrente");
      return;
    }
    const onderwerp = title.split("|").map((s) => s.trim()).filter((s) => s && !BRANDING.has(s.toLowerCase())).join(" - ");
    const opgemaakt = formatPageTitle(title);
    // Past onderwerp plus merknaam niet, dan toont formatPageTitle het volledige onderwerp zonder merknaam.
    expect(opgemaakt === "ZP Zaken" || opgemaakt === `${onderwerp} | ZP Zaken` || opgemaakt === onderwerp).toBe(true);
    expect(opgemaakt.length).toBeLessThanOrEqual(60);
  });
  it("/over-ons heeft de vastgestelde titel", () => {
    const r = seoRoutes.find((x) => x.path === "/over-ons")!;
    expect(formatPageTitle(r.title)).toBe("Over ons - Direct en onafhankelijk, actief sinds 2013");
  });
});
