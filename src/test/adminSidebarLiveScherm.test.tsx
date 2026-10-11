import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rol = { isAdmin: false, isSupervisor: false, isVerzekering: false, isMarketing: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "t@zpzaken.nl" }, signOut: vi.fn(), ...rol }) }));
vi.mock("@/hooks/useAdminTaken", () => ({ useAdminTakenCount: () => ({ data: 0 }) }));
vi.mock("@/hooks/useMenuTellers", () => ({ useMenuTellers: () => ({ data: {} }) }));

import { AdminSidebar } from "@/components/admin/AdminSidebar";

const toon = (r: Partial<typeof rol>) => {
  Object.assign(rol, { isAdmin: false, isSupervisor: false, isVerzekering: false, isMarketing: false }, r);
  const u = render(<MemoryRouter initialEntries={["/admin/schermen"]}><AdminSidebar /></MemoryRouter>);
  const n = screen.queryAllByText("Live-scherm").length;
  u.unmount();
  return n;
};

describe("menu-item Live-scherm", () => {
  it("zichtbaar voor admin en supervisor", () => {
    expect(toon({ isAdmin: true, isSupervisor: true })).toBeGreaterThan(0);
    expect(toon({ isSupervisor: true })).toBeGreaterThan(0);
  });
  it("niet zichtbaar voor verzekering en marketing", () => {
    expect(toon({ isVerzekering: true })).toBe(0);
    expect(toon({ isMarketing: true })).toBe(0);
  });
});
