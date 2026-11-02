// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { eerlijkePlannerVolgorde, PLANNER_WERK_MS, PLANNER_BATCH_MAX } from "../../supabase/functions/_shared/plannerBatch";
import { maakExactTempo, ExactTijdelijkError } from "../../supabase/functions/_shared/exactTempo";

describe("planner bounded batches", () => {
  it("34 overdue rows do not displace 13 candidates for November 2", () => {
    const oud = Array.from({ length: 34 }, (_, id) => ({ id, periode_start: "2026-11-01" }));
    const nu = Array.from({ length: 13 }, (_, id) => ({ id: id + 34, periode_start: "2026-11-02" }));
    const all = eerlijkePlannerVolgorde([...oud, ...nu], "2026-11-02");
    expect(all.slice(0, PLANNER_BATCH_MAX).filter((r) => r.periode_start === "2026-11-02")).toHaveLength(10);
    expect(all).toHaveLength(47);
    expect(new Set(all.map((r) => r.id)).size).toBe(47);
  });
  it("leaves at least 110 seconds below the observed 203-second elapsed run", () => {
    expect(PLANNER_WERK_MS).toBe(90_000);
    expect(203_000 - PLANNER_WERK_MS).toBeGreaterThanOrEqual(110_000);
  });
  it("will not wait through Retry-After beyond its deadline or call Exact again", async () => {
    let t = 0; let calls = 0;
    const tempo = maakExactTempo({ nu: () => t, deadline: 90_000, slaap: async (ms) => { t += ms; } });
    await expect(tempo(async () => { calls++; return new Response(null, { status: 429, headers: { "retry-after": "60" } }); })).rejects.toBeInstanceOf(ExactTijdelijkError);
    expect(calls).toBe(2);
    expect(t).toBe(60_000);
  });
  it("persists a leased run before Exact and checkpoints each claimed candidate", () => {
    const src = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
    expect(src.indexOf('rpc("factuur_planner_start"')).toBeLessThan(src.indexOf("const tempo = maakExactTempo({ deadline:"));
    expect(src).toContain("} finally { await voortgang(); }");
    expect(src).toContain("wachtOpMail: true");
    expect(src).toContain('leadType: "factuur-planner-run"');
  });
});