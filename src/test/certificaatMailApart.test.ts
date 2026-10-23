// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mailCertificaat } from "../../supabase/functions/_shared/certificaatMail";
afterEach(() => vi.unstubAllGlobals());
const policy = { id: "test-policy", lead_id: "test-lead", pdf_url: "test.pdf", certificate_number: "ZPBAVTEST" };
function fixture() {
  const insert = vi.fn();
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { email: "test@zpzaken.nl", voornaam: "Test" } }), insert };
  const download = vi.fn().mockResolvedValue({ data: new Blob(["test-pdf"]), error: null });
  return { db: { from: () => q, storage: { from: () => ({ download }) } }, insert, download };
}
describe("separate certificate mail", () => {
  it("dry run has no download, send or log effect", async () => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const f = fixture();
    const result = await mailCertificaat(f.db, new Request("https://zpzaken.nl"), policy, { id: "test-reviewer" }, { dryRun: true });
    expect(result.status).toBe("zou_verzenden");
    expect(fetchMock).not.toHaveBeenCalled(); expect(f.download).not.toHaveBeenCalled(); expect(f.insert).not.toHaveBeenCalled();
  });
  it("uses existing certificate template and PDF with per-attempt idempotency", async () => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => name === "RESEND_API_KEY" ? "test-only" : undefined } });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"test-message"}', { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    const f = fixture();
    expect((await mailCertificaat(f.db, new Request("https://zpzaken.nl"), policy, { id: "test-reviewer" }, { idempotencyKey: "test-cert-attempt-1" })).status).toBe("verzonden");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).attachments).toEqual([{ filename: "ZPBAVTEST.pdf", content: btoa("test-pdf") }]);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("test-cert-attempt-1");
  });
});