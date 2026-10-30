// C8: enhanced conversions alleen met SHA-256 van het e-mailadres, alleen bij de afgeronde aanvraag.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const { trackPurchase, sha256EmailHex, normaliseerEmailVoorHash, GOOGLE_ADS_ID } = await import("@/lib/tracking");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function zetToestemming(marketing: boolean) {
  localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", necessary: true, analytics: true, marketing, timestamp: new Date().toISOString() }));
}

describe("hash-normalisatie", () => {
  it("trimt en zet in kleine letters", async () => {
    expect(normaliseerEmailVoorHash("  Sam.Jansen@Voorbeeld.NL ")).toBe("sam.jansen@voorbeeld.nl");
    expect(await sha256EmailHex("  Sam.Jansen@Voorbeeld.NL ")).toBe(sha("sam.jansen@voorbeeld.nl"));
    expect(await sha256EmailHex("")).toBeNull();
  });
});

describe("user_data bij afgeronde aanvraag", () => {
  let calls: unknown[][];
  beforeEach(() => {
    localStorage.clear();
    calls = [];
    (window as any).gtag = (...a: unknown[]) => calls.push(a);
    window.history.replaceState({}, "", "/verzekeringen");
  });

  it("zet alleen sha256_email_address vóór de conversie, zonder leesbaar e-mailadres", async () => {
    zetToestemming(true);
    await trackPurchase("ec-1", "p", "Pakket", 600, { email: " Klant@Voorbeeld.nl ", phone_number: "0612345678" } as any);
    const i = calls.findIndex((c) => c[0] === "set" && c[1] === "user_data");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(calls[i][2]).toEqual({ sha256_email_address: sha("klant@voorbeeld.nl") });
    const conv = calls.findIndex((c) => c[0] === "event" && c[1] === "conversion");
    if (conv >= 0) expect(i).toBeLessThan(conv);
    const alles = JSON.stringify(calls) + JSON.stringify((window as any).dataLayer ?? []);
    expect(alles.toLowerCase()).not.toContain("klant@voorbeeld.nl");
    expect(alles).not.toContain("0612345678");
  });

  it("zonder marketingtoestemming geen user_data", async () => {
    zetToestemming(false);
    await trackPurchase("ec-2", "p", "Pakket", 600, { email: "a@b.nl" });
    expect(calls.some((c) => c[1] === "user_data")).toBe(false);
  });

  it("user_data wordt alleen in de afgeronde-aanvraagmeting gezet", () => {
    const src = readFileSync("src/lib/tracking.ts", "utf8");
    expect(src.match(/"user_data"/g)?.length).toBe(1);
    const app = readFileSync("src/components/home/BAVApplicationModule.tsx", "utf8");
    expect(app).not.toMatch(/phone_number:\s*formData/);
    vi.restoreAllMocks();
  });

  it("tag AW-18497139684 blijft aanwezig", () => {
    expect(GOOGLE_ADS_ID).toBe("AW-18497139684");
    expect(readFileSync("index.html", "utf8") + readFileSync("src/lib/tracking.ts", "utf8")).toContain("AW-18497139684");
  });
});
