// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";

vi.mock("@/components/scherm/MachineScene", () => ({ default: ({ actief }: { actief: boolean }) => <div data-testid="machine" data-actief={String(actief)}>Afdelingen</div> }));
vi.mock("@/lib/versieControle", () => ({ startVersieControle: () => () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
import Scherm from "@/pages/Scherm";

describe("permanent agentkantoor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/tv?token=mock");
    const payload = bouwSchermPayload({});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => payload })));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("houdt MachineScene actief na 60 seconden terwijl alle tien rapporten draaien", async () => {
    render(<HelmetProvider><Scherm tv /></HelmetProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId("machine")).toHaveAttribute("data-actief", "true");
    expect(screen.getByTestId("rapportage-paneel")).toHaveAttribute("data-paneel", "0");
    expect(screen.getByTestId("paneel-puntjes").children).toHaveLength(10);
    const machine = screen.getByTestId("machine");
    for (let i = 1; i <= 10; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(screen.getByTestId("machine")).toBe(machine);
      expect(screen.getByTestId("agentkantoor")).not.toHaveAttribute("aria-hidden", "true");
      expect(machine).toHaveAttribute("data-actief", "true");
      expect(screen.getByTestId("rapportage-paneel")).toHaveAttribute("data-paneel", String(i % 10));
      if (i === 7) expect(screen.getByText("Ons AI-team")).toBeInTheDocument();
      if (i === 8) expect(screen.getByText("Alle workers")).toBeInTheDocument();
      if (i === 9) expect(screen.getByText("Processtromen")).toBeInTheDocument();
      if (i === 2) expect(screen.getByText("Netto groei")).toBeInTheDocument();
    }
  });
});