// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetOpenAiVoorTest, installeerOpenAiPixel, openAiPageView, openAiAanvraagAfgerond } from "@/lib/tracking";

const consent = (marketing: boolean) => localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing }));
type Queue = ((...args: unknown[]) => void) & { q?: unknown[][] };
const pixelWindow = window as unknown as { oaiq?: Queue };

describe("OpenAI paginaweergaven en wachtrij", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/bav-zzp");
    delete pixelWindow.oaiq;
    document.head.querySelectorAll('script[src*="oaiq"]').forEach(s => s.remove());
    __resetOpenAiVoorTest();
  });

  it("bewaart page_viewed contents en lead_created customer_action vóór het script geladen is", () => {
    consent(true);
    installeerOpenAiPixel("/bav-zzp");
    openAiPageView("/bav-zzp", "a");
    openAiAanvraagAfgerond(false);
    expect(pixelWindow.oaiq?.q).toEqual([
      ["init", { pixelId: "SxHpKs2V6EgSyfvtYJwquQ" }],
      ["measure", "page_viewed", { type: "contents" }],
      ["measure", "lead_created", { type: "customer_action" }],
    ]);
    expect(document.head.querySelectorAll('script[src*="oaiq"]')).toHaveLength(1);
  });

  it("meet iedere SPA-navigatie, ook terugkeer, zonder dubbele effectaanroep", () => {
    consent(true);
    const measure = vi.fn();
    pixelWindow.oaiq = measure;
    openAiPageView("/bav-zzp", "a");
    openAiPageView("/bav-zzp", "a");
    openAiPageView("/contact", "b");
    openAiPageView("/bav-zzp", "c");
    expect(measure.mock.calls.filter(c => c[1] === "page_viewed")).toEqual(Array.from({ length: 3 }, () => ["measure", "page_viewed", { type: "contents" }]));
  });

  it("meet alleen de huidige pagina na akkoord, nooit eerdere geweigerde pagina's", () => {
    openAiPageView("/contact", "a");
    openAiPageView("/bav-zzp", "b");
    expect(pixelWindow.oaiq).toBeUndefined();
    consent(true);
    openAiPageView("/bav-zzp", "b");
    expect(pixelWindow.oaiq?.q?.filter(c => c[1] === "page_viewed")).toHaveLength(1);
    consent(false);
    openAiPageView("/contact", "c");
    openAiAanvraagAfgerond(false);
    expect(pixelWindow.oaiq?.q?.filter(c => c[0] === "measure")).toHaveLength(1);
  });

  for (const path of ["/admin", "/portal", "/mijn-zp", "/scherm", "/tv", "/en/admin/a"]) {
    it(`stuurt niets en laadt geen pixel op ${path}`, () => {
      consent(true);
      window.history.replaceState({}, "", path);
      openAiPageView(path, "a");
      openAiAanvraagAfgerond(false);
      expect(pixelWindow.oaiq).toBeUndefined();
      expect(document.head.querySelector('script[src*="oaiq"]')).toBeNull();
    });
  }
});