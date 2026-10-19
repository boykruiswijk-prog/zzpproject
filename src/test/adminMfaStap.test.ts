// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
const mfa = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: mfa } } } }));
import { controleerAdminMfa, verwerkMfaFout } from "@/lib/adminMfaStap";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("admin MFA step-up for cancellation mail", () => {
  for (const level of ["aal1", "aal2"]) it(level, async () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { pathname: "/admin/klanten", search: "?id=123", hash: "", assign } });
    mfa.mockResolvedValue({ data: { currentLevel: level }, error: null });
    expect(await controleerAdminMfa()).toBe(level === "aal2");
    if (level === "aal1") expect(assign).toHaveBeenCalledWith("/admin/login?next=%2Fadmin%2Fklanten%3Fid%3D123");
    else expect(assign).not.toHaveBeenCalled();
  });
  it("reads structured edge error and preserves the response", async () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { pathname: "/admin", search: "", hash: "", assign } });
    const response = new Response(JSON.stringify({ error: "mfa_required" }), { status: 403 });
    expect(await verwerkMfaFout({ context: response })).toBe(true);
    expect(assign).toHaveBeenCalledOnce(); expect(await response.json()).toEqual({ error: "mfa_required" });
  });
});