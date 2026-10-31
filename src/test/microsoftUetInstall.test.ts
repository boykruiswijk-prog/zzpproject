// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners: Array<{ type: string; listener: EventListenerOrEventListenerObject }> = [];

describe("Microsoft UET-installatie", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      listeners.push({ type, listener });
      add(type, listener, options);
    });
    vi.resetModules(); localStorage.clear();
    // Bewaar de echte scriptelementen, maar download nooit advertentiecode in unit-tests.
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
      if (node instanceof HTMLScriptElement) node.type = "application/x-test";
      return append(node);
    });
    document.querySelectorAll('script[src="https://bat.bing.com/bat.js"]').forEach(s => s.remove());
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: true }));
    window.history.replaceState({}, "", "/verzekeringen");
  });
  afterEach(() => {
    for (const { type, listener } of listeners.splice(0)) window.removeEventListener(type, listener);
  });
  it("start op een publiek pad na binnenkomst op een uitgesloten pad", async () => {
    const t = await import("@/lib/tracking");
    t.installeerUet("/admin");
    expect(document.querySelector('script[src="https://bat.bing.com/bat.js"]')).toBeNull();
    t.uetPageView("/verzekeringen");
    expect(document.querySelectorAll('script[src="https://bat.bing.com/bat.js"]')).toHaveLength(1);
  });
  it("herstelt na een mislukte scriptdownload zonder dubbele installatie", async () => {
    const t = await import("@/lib/tracking");
    t.installeerUet("/verzekeringen");
    const script = document.querySelector('script[src="https://bat.bing.com/bat.js"]');
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event("error"));
    t.uetPageView("/contact"); t.uetPageView("/contact");
    expect(document.querySelectorAll('script[src="https://bat.bing.com/bat.js"]')).toHaveLength(1);
  });
  it("herhaalt de eerste pagina niet en stuurt aanvraag_afgerond via tag 187280316", async () => {
    const t = await import("@/lib/tracking");
    const push = vi.fn(); const construct = vi.fn();
    Object.assign(window, { uetq: [], UET: class { constructor(o: unknown) { construct(o); } push = push; } });
    t.installeerUet("/verzekeringen");
    t.uetPageView("/verzekeringen"); t.uetPageView("/verzekeringen");
    document.querySelector('script[src="https://bat.bing.com/bat.js"]')?.dispatchEvent(new Event("load"));
    t.uetAanvraagAfgerond(false);
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ ti: "187280316" }));
    expect(push.mock.calls).toEqual([["pageLoad"], ["event", "aanvraag_afgerond", { event_category: "aanvraag" }]]);
  });
  it("volgt ingetrokken toestemming uit een ander tabblad en blokkeert nieuwe events", async () => {
    const t = await import("@/lib/tracking");
    t.installeerUet("/verzekeringen");
    const push = vi.fn(); Object.assign(window, { uetq: { push } });
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: false }));
    window.dispatchEvent(new StorageEvent("storage", { key: "zpzaken_cookie_consent" }));
    t.uetAanvraagAfgerond(false); t.uetSecundair("contactformulier_verzonden", false); t.uetPageView("/contact");
    expect(push.mock.calls).toEqual([["consent", "update", { ad_storage: "denied" }]]);
  });
});