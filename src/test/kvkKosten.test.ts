// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { haalKvkProfiel, kvkBevraagbaar, kvkStarterOordeel, KVK_TEST_URL } from "../../supabase/functions/_shared/kvk";

const BASIS = { kvkNummer: "12345678", naam: "Test BV", formeleRegistratiedatum: "20260301", materieleRegistratie: { datumAanvang: "20260301" } };

function nepAdmin(o: { aan?: boolean; cache?: any; teller?: { dag: number; maand: number }; claim?: boolean; dagLimiet?: number } = {}) {
  const log: any[] = []; const upserts: any[] = []; const rpcs: string[] = [];
  let cache = o.cache ?? null;
  const tabel = (t: string) => {
    const b: any = {
      select: () => b, eq: () => b,
      maybeSingle: async () => ({ data: t === "kvk_profielen" ? cache : t === "integratie_config" ? { enabled: o.aan ?? true } : t === "kvk_instellingen" ? { dag_limiet: o.dagLimiet ?? 100, maand_limiet: 1000, basis_url: "https://api.kvk.nl/api/v1" } : null }),
      insert: (r: any) => { log.push(r); return Promise.resolve({}); },
      upsert: (r: any) => { upserts.push(r); cache = { profiel: r.profiel, opgehaald_op: r.opgehaald_op }; return Promise.resolve({}); },
    };
    return b;
  };
  return {
    log, upserts, rpcs, zetCache: (c: any) => { cache = c; },
    from: tabel,
    rpc: async (n: string) => { rpcs.push(n); if (n === "kvk_betaald_teller") return { data: o.teller ?? { dag: 0, maand: 0 } }; if (n === "kvk_claim") return { data: o.claim ?? true }; return { data: null }; },
  };
}
const okFetch = () => vi.fn(async () => new Response(JSON.stringify(BASIS), { status: 200 }));

describe("KVK-kostenbewaking (A12)", () => {
  it("valideert vooraf: geen bevraging bij ongeldig nummer of 00000000", async () => {
    expect(kvkBevraagbaar("00000000")).toBe(false);
    expect(kvkBevraagbaar("1234567")).toBe(false);
    for (const n of ["00000000", "1234567", "1234567a"]) {
      const a = nepAdmin(); const f = okFetch();
      const r = await haalKvkProfiel(a, n, { bron: "aanvraag", fetchFn: f as any, sleutel: "k" });
      expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled(); expect(a.log[0].resultaat).toBe("ongeldig");
    }
  });
  it("cachetreffer jonger dan 30 dagen: geen fetch, geen kosten", async () => {
    const a = nepAdmin({ cache: { profiel: { naam: "X" }, opgehaald_op: new Date(Date.now() - 5 * 864e5).toISOString() } }); const f = okFetch();
    const r = await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: "k" });
    expect(r.ok && r.uit_cache).toBe(true); expect(f).not.toHaveBeenCalled();
    expect(a.log[0]).toMatchObject({ uit_cache: true, kosten_eur: 0 });
  });
  it("uitschakelaar uit: geen fetch", async () => {
    const a = nepAdmin({ aan: false }); const f = okFetch();
    const r = await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: "k" });
    expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled(); expect(a.log[0].resultaat).toBe("uitgeschakeld");
  });
  it("geen sleutel: geen fetch, resultaat geen_sleutel", async () => {
    const a = nepAdmin(); const f = okFetch();
    await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: null });
    expect(f).not.toHaveBeenCalled(); expect(a.log[0].resultaat).toBe("geen_sleutel");
  });
  it("limiet bereikt: geen fetch, log limiet en machine_log fout", async () => {
    const a = nepAdmin({ teller: { dag: 100, maand: 100 } }); const f = okFetch();
    const r = await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: "k" });
    expect(r.ok).toBe(false); expect(f).not.toHaveBeenCalled();
    expect(a.log[0].resultaat).toBe("limiet"); expect(a.rpcs).toContain("machine_log");
  });
  it("betaalde bevraging: alleen Basisprofiel zonder geodata, kosten 0,02, cache gevuld", async () => {
    const a = nepAdmin(); const f = okFetch();
    const r = await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: "k" });
    expect(r.ok).toBe(true); expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as any[])[0])).toBe("https://api.kvk.nl/api/v1/basisprofielen/12345678?geoData=false");
    expect(a.log.at(-1)).toMatchObject({ resultaat: "ok", kosten_eur: 0.02 }); expect(a.upserts).toHaveLength(1);
    expect(a.rpcs).toContain("kvk_claim_vrijgeven");
  });
  it("dedupe: zonder claim geen fetch, wacht op het profiel van de lopende bevraging", async () => {
    const a = nepAdmin({ claim: false }); const f = okFetch();
    setTimeout(() => a.zetCache({ profiel: { naam: "Gelijktijdig" }, opgehaald_op: new Date().toISOString() }), 300);
    const r = await haalKvkProfiel(a, "12345678", { bron: "aanvraag", fetchFn: f as any, sleutel: "k", wachtMs: 2000 });
    expect(f).not.toHaveBeenCalled(); expect(r.ok && r.uit_cache).toBe(true);
  });
  it("rooktest gaat hard naar de testomgeving, zonder cache of kosten", async () => {
    const a = nepAdmin({ aan: false }); const f = okFetch();
    await haalKvkProfiel(a, "69599084", { bron: "x", fetchFn: f as any, testomgeving: true });
    expect(String((f.mock.calls[0] as any[])[0]).startsWith(KVK_TEST_URL)).toBe(true);
    expect(a.upserts).toHaveLength(0); expect(a.log.at(-1)).toMatchObject({ bron: "rooktest", kosten_eur: 0 });
  });
});

describe("startersregel KVK rond 12 maanden", () => {
  const p = { datum_inschrijving: "2025-10-14", datum_aanvang: "2025-10-14" };
  it("voldoet tot de dag voor 12 maanden, niet op of na de grens", () => {
    expect(kvkStarterOordeel(p, "2026-10-13")?.voldoet).toBe(true);
    expect(kvkStarterOordeel(p, "2026-10-14")?.voldoet).toBe(false);
    expect(kvkStarterOordeel(p, "2026-10-14")?.tekst).toBe("Voldoet niet (ingeschreven 14-10-2025; startertarief vervalt per 14-10-2026)");
    expect(kvkStarterOordeel(p, "2025-10-14")?.tekst).toBe("Voldoet volgens KVK (ingeschreven 14-10-2025)");
    expect(kvkStarterOordeel(p, "2025-10-13")?.voldoet).toBe(false);
  });
  it("datum aanvang meer dan 30 dagen afwijkend is een aandachtspunt", () => {
    expect(kvkStarterOordeel({ datum_inschrijving: "2026-03-01", datum_aanvang: "2026-01-01" }, "2026-10-14")?.aandacht).toContain("wijkt");
    expect(kvkStarterOordeel({ datum_inschrijving: "2026-03-01", datum_aanvang: "2026-02-20" }, "2026-10-14")?.aandacht).toBeNull();
  });
});

describe("rooktest KVK-testomgeving (echt netwerk, kost niets)", () => {
  it("haalt het testprofiel 69599084 op", async () => {
    const a = nepAdmin();
    const r = await haalKvkProfiel(a, "69599084", { bron: "rooktest", testomgeving: true });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.profiel.naam).toBe("Test EMZ Dagobert"); expect(r.profiel.datum_inschrijving).toBe("2017-07-10"); }
  }, 20000);
});
