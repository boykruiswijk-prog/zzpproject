// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rol = { isAdmin: false, isSupervisor: false, isVerzekering: false, isMarketing: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "t@zpzaken.nl" }, signOut: vi.fn(), ...rol }) }));
vi.mock("@/hooks/useAdminTaken", () => ({ useAdminTakenCount: () => ({ data: 0 }) }));
vi.mock("@/hooks/useMenuTellers", () => ({ useMenuTellers: () => ({ data: {} }) }));

import { AdminSidebar } from "@/components/admin/AdminSidebar";

describe("tijdelijke plaatscontrole", () => {
  it("Live-scherm staat direct onder Dashboard", () => {
    Object.assign(rol, { isAdmin: true, isSupervisor: true, isVerzekering: false, isMarketing: false });
    const { container } = render(<MemoryRouter initialEntries={["/admin"]}><AdminSidebar /></MemoryRouter>);
    const links = [...container.querySelectorAll("nav a")].map((a) => a.textContent?.trim());
    console.log("Volgorde:", JSON.stringify(links));
    expect(links[0]).toBe("Dashboard");
    expect(links[1]).toBe("Live-scherm");
    expect(links.filter((l) => l === "Live-scherm").length).toBe(1);
  });
});
