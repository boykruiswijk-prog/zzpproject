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

  it("houdt MachineScene actief bij alle paneelwissels terwijl alle negen rapporten draaien", async () => {
    render(<HelmetProvider><Scherm tv /></HelmetProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId("machine")).toHaveAttribute("data-actief", "true");
    expect(screen.getByTestId("rapportage-paneel")).toHaveAttribute("data-paneel", "0");
    expect(screen.getByTestId("paneel-puntjes").children).toHaveLength(9);
    expect(screen.getByTestId("workers-vast")).toHaveTextContent("Alle workers");
    const machine = screen.getByTestId("machine");
    for (let i = 1; i <= 9; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
      expect(screen.getByTestId("machine")).toBe(machine);
      expect(screen.getByTestId("agentkantoor")).not.toHaveAttribute("aria-hidden", "true");
      expect(machine).toHaveAttribute("data-actief", "true");
      expect(screen.getByTestId("rapportage-paneel")).toHaveAttribute("data-paneel", String(i % 9));
      if (i === 7) expect(screen.getByText("Ons AI-team")).toBeInTheDocument();
      expect(screen.getByTestId("workers-vast")).toHaveTextContent("Alle workers");
      expect(screen.getByTestId("rapportage-paneel")).not.toHaveTextContent("Alle workers");
      if (i === 8) expect(screen.getByText("Processtromen")).toBeInTheDocument();
      if (i === 2) expect(screen.getByText("Netto groei")).toBeInTheDocument();
    }
  });

  it("behoudt alle 23 vaste workers inclusief de laatste drie", async () => {
    const payload = bouwSchermPayload({});
    const worker = (i: number) => ({ naam: `Worker ${i}`, status: 'klaar' as const, ritme: 'elke werkdag', laatste: null, vandaag: i, week: i * 7 });
    payload.workers = { gepland: Array.from({length:16}, (_,i) => worker(i)), op_afroep: Array.from({length:7}, (_,i) => worker(i+16)) };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok:true,status:200,json:async () => payload})));
    render(<HelmetProvider><Scherm tv /></HelmetProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const rows = screen.getByTestId('workers-vast').querySelectorAll('[data-worker]');
    expect(rows).toHaveLength(23);
    expect(Array.from(rows, row => row.getAttribute('data-worker'))).toEqual(Array.from({length:23}, (_,i) => `Worker ${i}`));
  });
});

describe("A7-aanvulling workers vast", () => {
  it("PANELEN bevat geen PaneelWorkers maar wel PaneelNettoGroei", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/pages/Scherm.tsx", "utf8");
    const m = /const PANELEN = \[([^\]]*)\]/.exec(src);
    expect(m?.[1]).not.toContain("PaneelWorkers");
    expect(m?.[1]).toContain("PaneelNettoGroei");
  });
});
