// @vitest-environment node
import { describe, expect, it } from "vitest";
import { saneerAttributie, attributieRegels } from "../../supabase/functions/_shared/attributie";
import { isNlTelefoon, normaliseerNlTelefoon } from "../../supabase/functions/_shared/telefoon";
import { isNietGemetenPad } from "@/lib/tracking";

describe("attributie", () => {
  it("herkent AI-verwijzers en schoont referrer op", () => {
    const a = saneerAttributie({ referrer: "https://chatgpt.com/c/123?q=geheim", landingspagina: "/verzekeringen?x=1" });
    expect(a?.kanaal).toBe("ai");
    expect(a?.referrer).toBe("https://chatgpt.com/c/123");
    expect(a?.landingspagina).toBe("/verzekeringen");
    expect(saneerAttributie({ utm_source: "perplexity.ai" })?.kanaal).toBe("ai");
    expect(saneerAttributie({ gclid: "abc-1" })?.kanaal).toBe("betaald");
    expect(saneerAttributie({ gclid: "<script>" })).toBeNull();
    expect(saneerAttributie({ onbekend: "x" })).toBeNull();
    expect(attributieRegels({ referrer: "https://claude.ai/" })[0]).toEqual(["Bron", "AI-assistent"]);
  });
});

describe("telefoon", () => {
  it("accepteert +31, 0031, spaties en streepjes en normaliseert", () => {
    for (const v of ["0612345678", "+31 6 12345678", "0031-6-1234-5678", "06 123 456 78"]) {
      expect(isNlTelefoon(v)).toBe(true);
      expect(normaliseerNlTelefoon(v)).toBe("0612345678");
    }
    expect(isNlTelefoon("12345")).toBe(false);
  });
});

describe("GA-uitsluiting", () => {
  it("meet nooit admin/portal/mijn-zp", () => {
    expect(isNietGemetenPad("/admin/leads")).toBe(true);
    expect(isNietGemetenPad("/en/portal")).toBe(true);
    expect(isNietGemetenPad("/mijn-zp")).toBe(true);
    expect(isNietGemetenPad("/verzekeringen")).toBe(false);
  });
});
