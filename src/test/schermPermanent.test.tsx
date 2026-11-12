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

  it("houdt MachineScene actief bij alle paneelwissels terwijl alle negen rapporten (paneel Vandaag vervallen 12-11) draaien", async () => {
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
      if (i === 6) expect(screen.getByText("Ons AI-team")).toBeInTheDocument();
      expect(screen.getByTestId("workers-vast")).toHaveTextContent("Alle workers");
      expect(screen.getByTestId("rapportage-paneel")).not.toHaveTextContent("Alle workers");
      if (i === 7) expect(screen.getByText("Processtromen")).toBeInTheDocument();
      if (i === 2) expect(screen.getByText("Netto groei")).toBeInTheDocument();
    }
  });

  it("toont alleen een samenvatting van de workers, niet alle regels (A8-aanvulling)", async () => {
    const payload = bouwSchermPayload({});
    const nu = Date.parse(payload.gegenereerd_op);
    const worker = (i: number) => ({ naam: `Worker ${i}`, status: (i === 3 ? 'fout' : 'klaar') as 'fout' | 'klaar', ritme: 'elke werkdag', laatste: i === 5 ? new Date(nu - 60_000).toISOString() : null, vandaag: i, week: i * 7, volgende: new Date(nu + (20 - i) * 60_000).toISOString() });
    payload.workers = { gepland: Array.from({length:18}, (_,i) => worker(i)), op_afroep: Array.from({length:7}, (_,i) => ({ ...worker(i+18), volgende: null })) };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok:true,status:200,json:async () => payload})));
    render(<HelmetProvider><Scherm tv /></HelmetProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const strook = screen.getByTestId('workers-vast');
    expect(strook.querySelectorAll('[data-worker]')).toHaveLength(0);
    expect(strook).toHaveTextContent('Alle workers 25: 23 goed, 1 bezig, 1 fout');
    expect(screen.getByTestId('workers-volgende').textContent).toMatch(/Worker 17.*Worker 16.*Worker 15/);
    expect(screen.getByTestId('workers-volgende')).not.toHaveTextContent('Worker 14');
    expect(screen.getByTestId('workers-fout')).toHaveTextContent('Fout: Worker 3');
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
