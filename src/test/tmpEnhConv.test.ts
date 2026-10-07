// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const setSpy = vi.fn();
const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;

g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
g.window = {
  location: { pathname: "/verzekeringen", href: "https://zpzaken.nl/verzekeringen" },
  localStorage: g.localStorage,
  gtag: (...a: unknown[]) => setSpy(...a),
};

const toestemming = (marketing: boolean) =>
  (g.localStorage as { setItem: (k: string, v: string) => void }).setItem(
    "zpzaken_cookie_consent",
    JSON.stringify({ version: "1.0", marketing }),
  );

const user_data = () => setSpy.mock.calls.find((c) => c[0] === "set" && c[1] === "user_data")?.[2];
const win = () => g.window as { location: { pathname: string } };

describe("enhanced conversions", () => {
  beforeEach(() => {
    setSpy.mockClear();
    logSpy.mockClear();
    store.clear();
    win().location.pathname = "/verzekeringen";
  });

  it("stuurt user_data met E.164 en lowercase e-mail bij marketingtoestemming", async () => {
    toestemming(true);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-1", "bav-avb-maand", "BAV + AVB", 660, { email: " Jan@Bedrijf.NL ", phone_number: "06 12345678" });
    expect(user_data()).toEqual({ email: "jan@bedrijf.nl", phone_number: "+31612345678" });
    const conversie = setSpy.mock.calls.find((c) => c[0] === "event" && c[1] === "conversion");
    expect(conversie?.[2]).toMatchObject({ send_to: "AW-18497139684/rIoQCIid-5IdEOTnj_RE", value: 660 });
  });

  it("niets zonder marketingtoestemming", async () => {
    toestemming(false);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-2", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl", phone_number: "0612345678" });
    expect(user_data()).toBeUndefined();
  });

  it("laat ongeldige telefoon weg en stuurt alleen e-mail", async () => {
    toestemming(true);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-3", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl", phone_number: "12345" });
    expect(user_data()).toEqual({ email: "jan@bedrijf.nl" });
  });

  it("meet niet op /admin", async () => {
    toestemming(true);
    win().location.pathname = "/admin/leads";
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-4", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl", phone_number: "0612345678" });
    expect(user_data()).toBeUndefined();
  });

  it("logt nooit e-mail of telefoon", async () => {
    toestemming(true);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-5", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl", phone_number: "+31 6 12345678" });
    const alles = logSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(alles).not.toContain("jan@bedrijf.nl");
    expect(alles).not.toContain("12345678");
  });

  it("dedup per transaction_id blijft werken", async () => {
    toestemming(true);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-6", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl" });
    trackPurchase("tx-6", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl" });
    expect(setSpy.mock.calls.filter((c) => c[1] === "purchase")).toHaveLength(1);
  });
});
