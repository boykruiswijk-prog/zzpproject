// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const setSpy = vi.fn();
(window as unknown as { gtag: (...a: unknown[]) => void }).gtag = (...a: unknown[]) => setSpy(...a);

const toestemming = (marketing: boolean) =>
  localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", marketing }));

const user_data = () => setSpy.mock.calls.find((c) => c[0] === "set" && c[1] === "user_data")?.[2];

describe("enhanced conversions", () => {
  beforeEach(() => {
    setSpy.mockClear();
    localStorage.clear();
    window.history.replaceState({}, "", "/verzekeringen");
  });

  it("stuurt gemaskeerd-verse user_data bij marketingtoestemming", async () => {
    toestemming(true);
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-1", "bav-avb-maand", "BAV + AVB", 660, { email: " Jan@Bedrijf.NL ", phone_number: "06 12345678" });
    expect(user_data()).toEqual({ email: "jan@bedrijf.nl", phone_number: "+31612345678" });
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
    window.history.replaceState({}, "", "/admin/leads");
    const { trackPurchase } = await import("@/lib/tracking");
    trackPurchase("tx-4", "bav-avb-maand", "BAV + AVB", 660, { email: "jan@bedrijf.nl", phone_number: "0612345678" });
    expect(user_data()).toBeUndefined();
  });
});
