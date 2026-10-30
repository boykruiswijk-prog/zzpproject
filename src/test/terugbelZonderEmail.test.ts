// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { geldigEmail } from "../../supabase/functions/_shared/geldigEmail";

const fetchMock = vi.fn();
vi.mock("../../supabase/functions/_shared/mail.ts", () => ({
  createMailGate: () => ({ plan: (p: any) => ({ send: true, from: "ZP <info@zpzaken.nl>", ...p }) }),
}));

function admin() {
  const inserts: any[] = [];
  const q: any = { select: () => q, eq: () => q, order: async () => ({ data: [{ email: "info@zpzaken.nl" }], error: null }), insert: async (r: any) => { inserts.push(r); return {}; } };
  return { inserts, from: () => q };
}

describe("terugbelverzoek zonder e-mailadres", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "x" }) });
    (globalThis as any).fetch = fetchMock;
    (globalThis as any).Deno = { env: { get: () => "key" } };
  });

  it("geldigEmail weigert leeg en ongeldig, accepteert geldig", () => {
    expect(geldigEmail("")).toBeUndefined();
    expect(geldigEmail("  ")).toBeUndefined();
    expect(geldigEmail("-")).toBeUndefined();
    expect(geldigEmail(undefined)).toBeUndefined();
    expect(geldigEmail(" klant@voorbeeld.nl ")).toBe("klant@voorbeeld.nl");
  });

  it("teammail zonder bezoekersadres gaat zonder reply_to", async () => {
    const { verstuurInterneMelding } = await import("../../supabase/functions/_shared/interneMelding");
    const a = admin();
    const res = await verstuurInterneMelding(a, null, "t", { leadType: "terugbelverzoek-chat", subject: "s", html: "h", replyTo: "" });
    expect(res.every((r) => r.ok)).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect("reply_to" in body).toBe(false);
  });

  it("teammail met bezoekersadres zet reply_to", async () => {
    const { verstuurInterneMelding } = await import("../../supabase/functions/_shared/interneMelding");
    await verstuurInterneMelding(admin(), null, "t", { leadType: "terugbelverzoek-chat", subject: "s", html: "h", replyTo: "klant@voorbeeld.nl" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBe("klant@voorbeeld.nl");
  });

  it("klantbevestiging alleen bij geldig adres, anders skipped", () => {
    const src = readFileSync("supabase/functions/send-lead-notification/index.ts", "utf8");
    expect(src).toMatch(/customerEmailRaw = geldigEmail\(/);
    expect(src).toMatch(/status: "skipped"/);
    expect(src).toMatch(/replyTo: isProd \? geldigEmail\(replyToEmail\)/);
  });
});
