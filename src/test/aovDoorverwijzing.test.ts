// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { aovBron, aovDoorklik, aovAnalyticsToestemming, aovWeekTotalen, aovCsv, AovOverzichtRij } from "@/lib/aovDoorverwijzing";
const rij = { klik_id: "0a634074-5a86-4f4c-9cd7-2ee2796adcaf", bron: "/movir?utm_source=nn", doel: "rekentool" as const, user_id: null, klant_ref: null };
describe("F9 minimale doorklik", () => {
  beforeEach(() => localStorage.clear());
  it.each(["rekentool", "advies"] as const)("registreert één %s met dezelfde klikcode en opent meteen", doel => {
    const schrijf = vi.fn(() => Promise.resolve({})); const open = vi.fn();
    aovDoorklik({ ...rij, doel }, schrijf, open);
    expect(schrijf).toHaveBeenCalledTimes(1); expect(schrijf).toHaveBeenCalledWith({ ...rij, doel });
    const url = new URL(open.mock.calls[0][0]);
    expect(url.searchParams.get("ref")).toBe(rij.klik_id);
    expect(url.searchParams.get("utm_source")).toBe("zpzaken");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("aov");
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(schrijf.mock.invocationCallOrder[0]);
  });
  it("blijft openen bij mislukte insert", async () => {
    const open = vi.fn(); aovDoorklik(rij, () => Promise.reject(new Error("fout")), open);
    await Promise.resolve(); expect(open).toHaveBeenCalledTimes(1);
    aovDoorklik(rij, () => { throw new Error("fout"); }, open); expect(open).toHaveBeenCalledTimes(2);
  });
  it("gebruikt alleen landing en toegestane UTM-codes", () => {
    expect(aovBron("/aov", { landingspagina: "/movir", utm_medium: "referral", email: "private" })).toBe("/movir?utm_medium=referral&utm_source=nn");
    expect(aovBron("/aov", { utm_source: "person@example.nl" })).toBe("/aov");
    expect(aovBron("/aov", null, true)).toBe("test");
  });
  it("analytics vereist actuele uitdrukkelijke toestemming", () => {
    expect(aovAnalyticsToestemming()).toBe(false);
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", analytics: false, marketing: true })); expect(aovAnalyticsToestemming()).toBe(false);
    localStorage.setItem("zpzaken_cookie_consent", JSON.stringify({ version: "1.0", analytics: true })); expect(aovAnalyticsToestemming()).toBe(true);
  });
  it("telt kalenderweken vanaf maandag en exporteert rijen", () => {
    const rows: AovOverzichtRij[] = ["2026-10-18T22:30:00Z", "2026-10-22T16:00:00Z", "2026-10-18T10:00:00Z"].map((created_at, i) => ({ ...rij, id: String(i), created_at, klant_naam: null }));
    expect(aovWeekTotalen(rows)).toEqual([["2026-10-19", 2], ["2026-10-12", 1]]);
    expect(aovCsv(rows).split("\r\n").length).toBe(4);
  });
});