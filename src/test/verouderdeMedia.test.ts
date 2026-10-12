import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { legacyRedirects, verouderdeMedia } from "@/config/legacyRedirects";

const regels = fs.readFileSync(path.resolve(__dirname, "../../public/_redirects"), "utf8")
  .split("\n").map((l) => l.replace(/\s+#.*$/, "").trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(/\s+/));

/** Eerste regel die matcht, zoals Netlify-achtige hosting de lijst afloopt. */
function eersteMatch(pad: string) {
  return regels.find(([from]) => from.endsWith("/*") ? pad.startsWith(from.slice(0, -1)) : from === pad);
}

describe("verouderde WordPress-formulieren", () => {
  it("de zeven oude pdf's verwijzen door vóór de media-wildcard", () => {
    const verwacht: Record<string, string> = {
      "/wp-content/uploads/2021/05/HRM-Finance-Branche-verklaring.pdf": "/verzekeringen",
      "/wp-content/uploads/2021/05/IT-Brancge-verklaring.pdf": "/verzekeringen",
      "/wp-content/uploads/2021/05/PR-Marketing-Branche-verklaring.pdf": "/verzekeringen",
      "/wp-content/uploads/2021/05/Techniek-Overig-Branche-Verklaring.pdf": "/verzekeringen",
      "/wp-content/uploads/2025/03/ZP-Zaken-Slotverklaring.pdf": "/documenten/slotverklaring-2026.pdf",
      "/wp-content/uploads/2025/11/ZP_Slotverklaring.pdf": "/documenten/slotverklaring-2026.pdf",
      "/wp-content/uploads/2023/03/Algemene-Voorwaarden-v1.0-Definitief.pdf": "/algemene-voorwaarden",
    };
    for (const [pad, doel] of Object.entries(verwacht)) {
      expect(eersteMatch(pad)?.[1], pad).toBe(doel);
      expect(verouderdeMedia.has(pad.slice(1))).toBe(true);
    }
    expect(verouderdeMedia.size).toBe(7);
    expect(legacyRedirects.filter((r) => r.from.startsWith("wp-content/")).length).toBe(7);
  });

  it("afbeeldingen en andere oude media gaan nog via de wildcard naar storage", () => {
    for (const pad of ["/wp-content/uploads/2024/12/laptops-593296_640.jpg", "/wp-content/uploads/2024/12/freelance-4523096_640.webp", "/wp-content/uploads/2023/12/Brochure-beroepsaansprakelijkheid.pdf"]) {
      const m = eersteMatch(pad);
      expect(m?.[0]).toBe("/wp-content/uploads/*");
      expect(m?.[1]).toMatch(/\/storage\/v1\/object\/public\/article-images\/wp-content\/uploads\/:splat$/);
    }
  });
});
