// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const maakOpslag = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), m };
};
const local = maakOpslag();
let session = maakOpslag();
const loc = { search: "", pathname: "/", host: "zpzaken.nl", hostname: "zpzaken.nl" };
const doc = { referrer: "" };
const g = globalThis as Record<string, unknown>;
g.localStorage = local;
Object.defineProperty(g, "sessionStorage", { get: () => session, configurable: true });
g.document = doc;
g.window = { location: loc, addEventListener: () => {} };

const { legAttributieVast, leesAttributie, LANG_KEY } = await import("@/lib/attributie");

function bezoek(url: string, referrer = "") {
  const u = new URL(url, "https://zpzaken.nl");
  loc.search = u.search; loc.pathname = u.pathname; doc.referrer = referrer;
  legAttributieVast();
}
const nieuweSessie = () => { session = maakOpslag(); };
const toestemming = (ja: boolean) => local.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: ja }));

describe("herkomst 90 dagen", () => {
  beforeEach(() => { local.clear(); nieuweSessie(); vi.useRealTimers(); });

  it("terugkerend bezoek in nieuwe sessie houdt utm", () => {
    bezoek("/verzekeringen?utm_source=nieuwsbrief&utm_medium=email");
    nieuweSessie();
    expect(leesAttributie()).toMatchObject({ utm_source: "nieuwsbrief", kanaal: "campagne" });
  });

  it("direct bezoek overschrijft betaalde herkomst niet", () => {
    bezoek("/?utm_source=google&utm_medium=cpc");
    nieuweSessie();
    bezoek("/contact");
    nieuweSessie();
    expect(leesAttributie()).toMatchObject({ utm_source: "google", landingspagina: "/" });
  });

  it("nieuwe utm overschrijft oude", () => {
    bezoek("/?utm_source=google");
    nieuweSessie();
    bezoek("/aov?utm_source=bing");
    nieuweSessie();
    expect(leesAttributie()).toMatchObject({ utm_source: "bing", landingspagina: "/aov" });
  });

  it("eerste direct bezoek wordt opgeslagen als er nog niets is", () => {
    bezoek("/faq", "https://www.google.com/search?q=x");
    nieuweSessie();
    expect(leesAttributie()).toMatchObject({ referrer: "https://www.google.com/search", kanaal: "verwijzing" });
  });

  it("na 90 dagen weg", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    bezoek("/?utm_source=google");
    nieuweSessie();
    vi.setSystemTime(new Date("2026-04-02T10:00:00Z"));
    expect(leesAttributie()).toBeNull();
    expect(local.getItem(LANG_KEY)).toBeNull();
  });

  it("klik-ID zonder toestemming wordt niet opgeslagen of verstuurd; marker wel", () => {
    toestemming(false);
    bezoek("/?gclid=abc123");
    expect([...local.m.values()].join()).not.toContain("abc123");
    expect([...session.m.values()].join()).not.toContain("abc123");
    const a = leesAttributie();
    expect(a?.gclid).toBeUndefined();
    expect(a).toMatchObject({ advertentieklik: "google", kanaal: "betaald" });
    nieuweSessie();
    expect(leesAttributie()?.gclid).toBeUndefined();
  });

  it("klik-ID met toestemming gaat mee, maar staat niet in het 90-dagenrecord", () => {
    toestemming(true);
    bezoek("/?gclid=abc123");
    expect(leesAttributie()?.gclid).toBe("abc123");
    expect(local.getItem(LANG_KEY)).not.toContain("abc123");
  });
});
