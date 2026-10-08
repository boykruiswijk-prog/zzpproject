// @vitest-environment node
import { describe, it, expect } from "vitest";
import { contractRegelVoorActivatie, factuurLogTekst, zetInPlanner } from "../../supabase/functions/_shared/klantContractActivatie";

// Nep-backend: weigert gegenereerde kolom maandwaarde zoals de echte database.
function nepSupabase() {
  const contracten: any[] = [];
  const ondernemingen: any[] = [];
  const q = (tabel: string) => {
    const filters: [string, unknown][] = [];
    const api: any = {
      select: () => api,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return api; },
      limit: () => api,
      maybeSingle: async () => ({ data: (tabel === "ondernemingen" ? ondernemingen : []).find((r) => filters.every(([k, v]) => r[k] === v)) ?? null }),
      insert: (row: any) => { const r = { id: `ond-${ondernemingen.length + 1}`, ...row }; ondernemingen.push(r); return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
      upsert: async (row: any) => {
        if ("maandwaarde" in row) return { error: { message: 'cannot insert a non-DEFAULT value into column "maandwaarde"' } };
        if (!contracten.some((c) => c.bron === row.bron && c.bron_rij === row.bron_rij)) contracten.push(row);
        return { error: null };
      },
    };
    return api;
  };
  return { from: q, contracten, ondernemingen };
}

const lead = (id: string) => ({ id, bedrijfsnaam: "TEST BV", exact_relatie_code: "TESTACT1", is_test: true });

describe("activatie zet klant in planner", () => {
  it("maandpakket: contractregel zonder maandwaarde, volgende periode na instap", async () => {
    const sb = nepSupabase();
    const r = await zetInPlanner(sb, lead("11111111-1111-1111-1111-111111111111"), "acc-1",
      { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: "2026-10-02", periodeEind: "2026-10-31" });
    expect(r.ok).toBe(true);
    expect(sb.contracten).toHaveLength(1);
    expect(sb.contracten[0]).toMatchObject({ cyclus: "maand", bedrag_per_periode: 55, gefactureerd_tm: "2026-10-31", volgende_factuurdatum: "2026-11-01", bron: "site_activatie" });
  });

  it("jaarpakket: contractregel met jaarperiode en idempotent", async () => {
    const sb = nepSupabase();
    const l = lead("22222222-2222-2222-2222-222222222222");
    const spec = { cyclus: "jaar" as const, itemcode: "100J", bedrag_per_periode: 660, periodeStart: "2026-10-02", periodeEind: "2027-10-01" };
    expect((await zetInPlanner(sb, l, "acc-2", spec)).ok).toBe(true);
    expect((await zetInPlanner(sb, l, "acc-2", spec)).ok).toBe(true);
    expect(sb.contracten).toHaveLength(1);
    expect(sb.ondernemingen).toHaveLength(1);
    expect(sb.contracten[0]).toMatchObject({ cyclus: "jaar", volgende_factuurdatum: "2027-10-02" });
    expect("maandwaarde" in contractRegelVoorActivatie(l, "x", spec)).toBe(false);
  });

  it("nieuwe maandcyber maakt een aparte regel van € 27,50 met cyberartikel", async () => {
    const sb = nepSupabase();
    const l = { ...lead("33333333-3333-3333-3333-333333333333"), gekozen_pakket: "maandelijks-cyber", cyber_voorwaarden_versie: "2026-10-08", cyber_ingangsdatum: "2026-10-02", cyber_einddatum: "2027-10-01" };
    const r = await zetInPlanner(sb, l, "acc-3", { cyclus: "maand", itemcode: "100M", bedrag_per_periode: 55, periodeStart: "2026-10-02", periodeEind: "2026-10-31" });
    expect(r.ok).toBe(true);
    expect(sb.contracten).toHaveLength(2);
    expect(sb.contracten[1]).toMatchObject({ product: "cyber_clear", itemcode: "102M", bedrag_per_periode: 27.5, cyber_einddatum: "2027-10-01" });
  });

  it("nieuwe jaarcyber maakt een aparte regel van € 250 met cyberartikel", async () => {
    const sb = nepSupabase();
    const l = { ...lead("44444444-4444-4444-4444-444444444444"), gekozen_pakket: "jaarlijks-cyber", cyber_voorwaarden_versie: "2026-10-08", cyber_ingangsdatum: "2026-10-02", cyber_einddatum: "2027-10-01" };
    const r = await zetInPlanner(sb, l, "acc-4", { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: 600, periodeStart: "2026-10-02", periodeEind: "2027-10-01" });
    expect(r.ok).toBe(true);
    expect(sb.contracten[1]).toMatchObject({ product: "cyber_clear", itemcode: "102J", bedrag_per_periode: 250 });
  });

  it("logtekst toont werkelijk factuurbedrag", () => {
    expect(factuurLogTekst(null, 53.23, { start: "2026-10-02", eind: "2026-10-31", naarRato: true }))
      .toBe("Factuur (concept) aangemaakt: € 53,23 (02-10-2026 t/m 31-10-2026, naar rato)");
  });
});
