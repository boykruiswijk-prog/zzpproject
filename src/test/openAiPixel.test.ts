// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bepaalKanaal, saneerAttributie, attributieRegels } from "../../supabase/functions/_shared/attributie";

const opslag = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => opslag.get(k) ?? null,
  setItem: (k: string, v: string) => void opslag.set(k, v),
  removeItem: (k: string) => void opslag.delete(k),
  clear: () => opslag.clear(),
};
const loc = { pathname: "/bav-zzp" };
(globalThis as Record<string, unknown>).localStorage = localStorage;
(globalThis as Record<string, unknown>).window = { location: loc, localStorage, addEventListener: () => {} };

const { __resetOpenAiVoorTest, trackPurchase, OPENAI_PIXEL_ID } = await import("@/lib/tracking");

const oaiq = vi.fn();
const leads = () => oaiq.mock.calls.filter((c) => c[1] === "lead_created");
const geefToestemming = (ja: boolean) =>
  localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: ja }));

describe("OpenAI ChatGPT Ads-pixel", () => {
  beforeEach(() => {
    oaiq.mockReset();
    localStorage.clear();
    loc.pathname = "/bav-zzp";
    ((globalThis as Record<string, unknown>).window as Record<string, unknown>).oaiq = oaiq;
    __resetOpenAiVoorTest(true);
  });

  it("gebruikt het pixel-ID uit het besluit", () => {
    expect(OPENAI_PIXEL_ID).toBe("SxHpKs2V6EgSyfvtYJwquQ");
  });

  it("stuurt lead_created als customer_action zonder persoonsgegevens bij een echte aanvraag, één keer", async () => {
    geefToestemming(true);
    // Met e-mail en toestemming wacht de meting op de SHA-256-hash (enhanced conversions, C8).
    await trackPurchase("lead-a", "p", "Pakket", 100, { email: "x@voorbeeld.nl" });
    await trackPurchase("lead-a", "p", "Pakket", 100);
    expect(leads()).toEqual([["measure", "lead_created", { type: "customer_action" }, { event_id: "bav_lead_lead-a" }]]);
  });

  it("stuurt niets bij een testaanvraag", () => {
    geefToestemming(true);
    trackPurchase("lead-b", "p", "Pakket", 100, undefined, true);
    expect(leads()).toHaveLength(0);
  });

  it("stuurt niets zonder marketingtoestemming", () => {
    geefToestemming(false);
    trackPurchase("lead-c", "p", "Pakket", 100);
    expect(leads()).toHaveLength(0);
  });

  it("stuurt niets op /admin, /portal, /mijn-zp of /tv", () => {
    geefToestemming(true);
    for (const p of ["/admin", "/portal/x", "/mijn-zp", "/tv"]) {
      loc.pathname = p;
      trackPurchase(`lead-${p}`, "p", "Pakket", 100);
    }
    expect(leads()).toHaveLength(0);
  });
});

describe("ChatGPT Ads-attributie", () => {
  it("utm_source=chatgpt is ChatGPT Ads, organisch chatgpt.com blijft AI-assistent", () => {
    expect(bepaalKanaal({ utm_source: "chatgpt" })).toBe("chatgpt_ads");
    expect(bepaalKanaal({ utm_source: "chatgpt.com" })).toBe("ai");
    expect(bepaalKanaal({ oppref: "abc.123~x" })).toBe("chatgpt_ads");
  });

  it("server bewaart oppref en toont bron ChatGPT Ads", () => {
    const a = saneerAttributie({ utm_source: "chatgpt", oppref: "abc.123~x", advertentieklik: "openai" });
    expect(a).toMatchObject({ oppref: "abc.123~x", advertentieklik: "openai", kanaal: "chatgpt_ads" });
    expect(attributieRegels(a)[0]).toEqual(["Bron", "ChatGPT Ads"]);
  });
});
