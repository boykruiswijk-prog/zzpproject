import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { exactCodeNorm, exactDatum } from "../../../supabase/functions/_shared/exactCodeMatch";

describe("exactCodeNorm", () => {
  it("trimt rechts-uitgelijnde Exact-codes en vergelijkt numeriek", () => {
    expect(exactCodeNorm("            2008975")).toBe("2008975");
    expect(exactCodeNorm("0002008975")).toBe("2008975");
    expect(exactCodeNorm("1000364 ")).toBe(exactCodeNorm("  1000364"));
  });
  it("houdt alfanumerieke codes als tekst", () => {
    expect(exactCodeNorm("  zp00030 ")).toBe("ZP00030");
    expect(exactCodeNorm("ZP00030")).not.toBe(exactCodeNorm("30"));
  });
  it("leeg wordt null", () => { expect(exactCodeNorm("   ")).toBeNull(); expect(exactCodeNorm(null)).toBeNull(); });
});

describe("exactDatum", () => {
  it("leest OData-datums", () => { expect(exactDatum("/Date(1760572800000)/")).toBe("2025-10-16"); expect(exactDatum(null)).toBeNull(); });
});

describe("exact-spiegel-sync is alleen-lezen", () => {
  const src = readFileSync("supabase/functions/exact-spiegel-sync/index.ts", "utf8");
  it("bevat geen schrijfmethode richting Exact", () => {
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect((src.match(/await fetch\(/g) ?? []).length).toBe(1);
    expect(src).toMatch(/method: "GET"/);
  });
  it("stuurt geen mails", () => { expect(src).not.toMatch(/sendExactAlarm|resend|enqueue_email/i); });
});
