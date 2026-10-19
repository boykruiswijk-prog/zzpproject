// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminAalGuard } from "@/components/admin/AdminAalGuard";

const mocks = vi.hoisted(() => ({ level: "aal2", session: true }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoading: false, isTeamMember: true, isSupervisor: true }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: mocks.session ? { user: { id: "supervisor" } } : null } }),
  mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: mocks.level, nextLevel: "aal2" }, error: null }) },
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
} } }));
function open() {
  render(<MemoryRouter initialEntries={["/admin"]}><Routes>
    <Route element={<AdminAalGuard />}><Route path="/admin" element={<div>supervisor-dashboard</div>} /></Route>
    <Route path="/admin/login" element={<div>mfa-login</div>} />
  </Routes></MemoryRouter>);
}
describe("Supervisor dashboard MFA access", () => {
  beforeEach(() => { cleanup(); mocks.level = "aal2"; mocks.session = true; });
  it("allows a signed-in supervisor with aal2 to reach dashboard", async () => {
    open(); expect(await screen.findByText("supervisor-dashboard")).toBeTruthy();
    expect(screen.queryByText("mfa-login")).toBeNull();
  });
  it("does not mount dashboard for aal1", async () => {
    mocks.level = "aal1"; open(); expect(await screen.findByText("mfa-login")).toBeTruthy();
    expect(screen.queryByText("supervisor-dashboard")).toBeNull();
  });
  it("does not mount dashboard without a session", async () => {
    mocks.session = false; open(); expect(await screen.findByText("mfa-login")).toBeTruthy();
    expect(screen.queryByText("supervisor-dashboard")).toBeNull();
  });
});