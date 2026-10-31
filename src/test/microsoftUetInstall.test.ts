// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Microsoft UET-installatie", () => {
  beforeEach(() => {
    vi.resetModules(); localStorage.clear();
    document.querySelectorAll('script[src="https://bat.bing.com/bat.js"]').forEach(s => s.remove());
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing: true }));
    window.history.replaceState({}, "", "/verzekeringen");
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
});