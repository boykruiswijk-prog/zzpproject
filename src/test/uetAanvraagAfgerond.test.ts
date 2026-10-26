// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const opslag = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => opslag.get(k) ?? null,
  setItem: (k: string, v: string) => void opslag.set(k, v),
  clear: () => opslag.clear(),
};
const loc = { pathname: "/verzekeringen" };
(globalThis as Record<string, unknown>).localStorage = localStorage;
(globalThis as Record<string, unknown>).window = { location: loc, localStorage };

const { __resetUetVoorTest, trackPurchase } = await import("@/lib/tracking");

const push = vi.fn();
const events = () => push.mock.calls.filter((c) => c[0] === "event" && c[1] === "aanvraag_afgerond");

describe("UET aanvraag_afgerond", () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    ((globalThis as Record<string, unknown>).window as Record<string, unknown>).uetq = { push };
    __resetUetVoorTest(true);
  });

  it("vuurt één keer bij een succesvolle echte aanvraag", () => {
    trackPurchase("lead-1", "p", "Pakket", 100);
    trackPurchase("lead-1", "p", "Pakket", 100);
    expect(events()).toEqual([["event", "aanvraag_afgerond", { event_category: "aanvraag" }]]);
  });

  it("vuurt niet bij een testaanvraag", () => {
    trackPurchase("lead-2", "p", "Pakket", 100, undefined, true);
    expect(events()).toHaveLength(0);
  });

  it("vuurt niet zonder geladen UET (geen marketingtoestemming)", () => {
    __resetUetVoorTest(false);
    trackPurchase("lead-3", "p", "Pakket", 100);
    expect(events()).toHaveLength(0);
  });
});

describe("UET secundaire events", () => {
  beforeEach(() => {
    push.mockReset();
    ((globalThis as Record<string, unknown>).window as Record<string, unknown>).uetq = { push };
    loc.pathname = "/contact";
  });
  it("terugbel, contact en offerte sturen een UET-event, test en /admin niet", async () => {
    const t = await import("@/lib/tracking");
    t.__resetUetVoorTest(true);
    t.trackTerugbelVerzonden(false); t.trackContactVerzonden(false); t.trackOfferteVerzonden(false);
    t.trackOfferteVerzonden(true);
    loc.pathname = "/admin/leads"; t.trackOfferteVerzonden(false);
    expect(push.mock.calls.map((c) => c[1])).toEqual(["terugbelverzoek_verzonden", "contactformulier_verzonden", "offerte_verzonden"]);
  });
});
