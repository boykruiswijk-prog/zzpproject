import { describe, it, expect } from "vitest";
import { seoRoutes } from "../config/seoRoutes";
import { formatPageTitle } from "../lib/seoTitle";

const BRANDING = new Set(["zp zaken", "zpzaken", "zpzaken.nl", "kennisbank"]);

describe("SEO-titels", () => {
  it.each(seoRoutes.map((r) => [r.path, r.title]))("%s wordt niet afgekapt", (_path, title) => {
    const onderwerp = title.split("|").map((s) => s.trim()).filter((s) => s && !BRANDING.has(s.toLowerCase())).join(" - ");
    const opgemaakt = formatPageTitle(title);
    expect(opgemaakt === "ZP Zaken" || opgemaakt === `${onderwerp} | ZP Zaken`).toBe(true);
    expect(opgemaakt.length).toBeLessThanOrEqual(60);
  });
  it("/over-ons heeft de vastgestelde titel", () => {
    const r = seoRoutes.find((x) => x.path === "/over-ons")!;
    expect(formatPageTitle(r.title)).toBe("Over ons - Direct en onafhankelijk sinds 2014 | ZP Zaken");
  });
});
