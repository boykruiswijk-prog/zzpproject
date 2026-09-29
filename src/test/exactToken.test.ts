// @vitest-environment node
import { ensureValidToken, tokenTiming } from "../../supabase/functions/_shared/exactToken";

// Minimale nep-database voor exact_config met een atomaire lock-update.
function maakDb(start: Record<string, unknown>) {
  const rij: Record<string, any> = { id: "cfg", ...start };
  const tick = () => new Promise((r) => setTimeout(r, 1));
  const from = () => {
    let patch: Record<string, unknown> | null = null;
    let lockFilter = false;
    const q: any = {
      select: () => q, eq: () => q, limit: () => q,
      update: (p: Record<string, unknown>) => { patch = p; return q; },
      or: () => { lockFilter = true; return q; },
      single: async () => { await tick(); return { data: { ...rij } }; },
      then: (res: any, rej: any) => (async () => {
        await tick();
        if (patch && lockFilter) {
          const vrij = !rij.refresh_lock_until || new Date(rij.refresh_lock_until).getTime() < Date.now();
          if (!vrij) return { data: [], error: null };
          Object.assign(rij, patch); return { data: [{ id: rij.id }], error: null };
        }
        if (patch) Object.assign(rij, patch);
        return { data: null, error: null };
      })().then(res, rej),
    };
    return q;
  };
  return { rij, sb: { from } };
}

describe("ensureValidToken: gelijktijdige refresh", () => {
  beforeEach(() => { tokenTiming.pollMs = 5; tokenTiming.maxWachtMs = 2000; });
  afterEach(() => vi.unstubAllGlobals());

  it("5 gelijktijdige aanroepen → precies 1 refresh, allemaal hetzelfde token", async () => {
    const { rij, sb } = maakDb({
      access_token: "oud", refresh_token: "r1", access_token_expires_at: new Date(Date.now() + 10_000).toISOString(),
      client_id: "c", client_secret: "s",
    });
    let refreshes = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      refreshes++;
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ access_token: "nieuw", refresh_token: "r2", expires_in: 600 }), { status: 200 });
    }));
    const tokens = await Promise.all(Array.from({ length: 5 }, () => ensureValidToken(sb, { ...rij })));
    expect(refreshes).toBe(1);
    expect(new Set(tokens)).toEqual(new Set(["nieuw"]));
    expect(rij.refresh_token).toBe("r2");
    expect(rij.refresh_lock_until).toBeNull();
  });

  it("geldig token (>60 s) → geen refresh", async () => {
    const { rij, sb } = maakDb({ access_token: "a", access_token_expires_at: new Date(Date.now() + 300_000).toISOString() });
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect(await ensureValidToken(sb, { ...rij })).toBe("a");
    expect(f).not.toHaveBeenCalled();
  });

  it("'access_token not expired' is geen fout: huidig token wordt gebruikt", async () => {
    const { rij, sb } = maakDb({
      access_token: "huidig", refresh_token: "r1", access_token_expires_at: new Date(Date.now() + 30_000).toISOString(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "invalid_request", error_description: "Rate limit exceeded: access_token not expired" }), { status: 400 })));
    expect(await ensureValidToken(sb, { ...rij })).toBe("huidig");
  });
});
