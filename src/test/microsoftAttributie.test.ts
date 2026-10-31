// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saneerAttributie } from "../../supabase/functions/_shared/attributie";

describe("Microsoft klikherkomst zonder echte inzending", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear(); sessionStorage.clear();
    window.history.replaceState({}, "", "/verzekeringen?msclkid=test123");
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://www.bing.com/search?q=zzp" });
  });
  const toestemming = (marketing: boolean) => localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing }));

  it("slaat test123 in zp_klikids op en behoudt deze in de gedeelde aanvraag/offerte/contact-attributie", async () => {
    toestemming(true);
    const a = await import("@/lib/attributie");
    a.legAttributieVast();
    expect(JSON.parse(localStorage.getItem("zp_klikids") ?? "{}").msclkid).toBe("test123");
    window.history.replaceState({}, "", "/contact");
    expect(saneerAttributie(a.leesAttributie())).toMatchObject({ msclkid: "test123", referrer: "https://www.bing.com/search", advertentieklik: "microsoft", marketing_toestemming: true });
  });
  it("verstuurd en bewaart geen msclkid zonder marketingtoestemming; Bing-verwijzer blijft behouden", async () => {
    toestemming(false);
    const a = await import("@/lib/attributie");
    a.legAttributieVast();
    expect(localStorage.getItem("zp_klikids")).toBeNull();
    expect(saneerAttributie(a.leesAttributie())?.msclkid).toBeUndefined();
    expect(a.leesAttributie()).toMatchObject({ referrer: "https://www.bing.com/search", advertentieklik: "microsoft", marketing_toestemming: false });
  });
  it("nieuwe Microsoft-binnenkomst vervangt oude Google-campagne en verwijzer in dezelfde sessie", async () => {
    toestemming(true);
    const a = await import("@/lib/attributie");
    window.history.replaceState({}, "", "/?utm_source=google&gclid=oud123");
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://www.google.com/" });
    a.legAttributieVast();
    window.history.replaceState({}, "", "/verzekeringen?msclkid=test123&utm_source=bing");
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://www.bing.com/search?q=zzp" });
    a.legAttributieVast();
    expect(saneerAttributie(a.leesAttributie())).toMatchObject({ msclkid: "test123", utm_source: "bing", referrer: "https://www.bing.com/search", landingspagina: "/verzekeringen" });
    expect(a.leesAttributie()?.gclid).toBeUndefined();
  });
});