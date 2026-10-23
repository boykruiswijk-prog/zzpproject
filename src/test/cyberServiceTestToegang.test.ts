// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isServiceTestRequest } from "../../supabase/functions/_shared/cyberTestToegang";
afterEach(() => vi.unstubAllGlobals());
describe("E4 service-only test access", () => {
  it("requires explicit test mode even with service identity", () => {
    vi.stubGlobal("Deno", { env: { get: () => "test-service-identity" } });
    const req = new Request("http://localhost", { headers: { Authorization: "Bearer test-service-identity" } });
    expect(isServiceTestRequest(req, false)).toBe(false);
    expect(isServiceTestRequest(req, true)).toBe(true);
  });
  it("rejects user JWT role claims and internal-secret instead of service identity", () => {
    vi.stubGlobal("Deno", { env: { get: () => "test-service-identity" } });
    expect(isServiceTestRequest(new Request("http://localhost", { headers: { Authorization: "Bearer user-jwt", "x-internal-secret": "test-service-identity" } }), true)).toBe(false);
  });
  it("opaque service identity uses apikey without bearer", () => {
    vi.stubGlobal("Deno", { env: { get: () => "sb_secret_test-fixture" } });
    expect(isServiceTestRequest(new Request("http://localhost", { headers: { apikey: "sb_secret_test-fixture" } }), true)).toBe(true);
    expect(isServiceTestRequest(new Request("http://localhost", { headers: { apikey: "sb_secret_test-fixture", Authorization: "Bearer sb_secret_test-fixture" } }), true)).toBe(false);
  });
});