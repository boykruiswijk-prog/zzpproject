// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
import { execFileSync } from "node:child_process";
import { checkNotFoundLog } from "../../scripts/notFoundGate";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("404 gate availability", () => {
  it.each(["CLI ontbreekt", "CLI timeout"])("waarschuwt en gaat door bij %s", async message => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error(message); });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(checkNotFoundLog("/tmp/nonexistent-loep-dist", "https://zpzaken.nl")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it("waarschuwt en gaat door bij een netwerk-timeout", async () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ rows: [{ pad: "/ontbrekend", aantal: 3, laatste_op: new Date().toISOString() }] }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(checkNotFoundLog("/tmp/nonexistent-loep-dist", "https://zpzaken.nl")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it("faalt nog steeds bij een bewezen HTTP 404", async () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ rows: [{ pad: "/ontbrekend", aantal: 3, laatste_op: new Date().toISOString() }] }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(checkNotFoundLog("/tmp/nonexistent-loep-dist", "https://zpzaken.nl")).rejects.toThrow("/ontbrekend: 404");
  });
});