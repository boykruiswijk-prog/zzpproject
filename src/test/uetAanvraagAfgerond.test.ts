import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetUetVoorTest, trackPurchase } from "@/lib/tracking";

const push = vi.fn();
const events = () => push.mock.calls.filter((c) => c[0] === "event" && c[1] === "aanvraag_afgerond");

describe("UET aanvraag_afgerond", () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    window.history.pushState({}, "", "/verzekeringen");
    (window as unknown as { uetq: unknown }).uetq = { push };
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
