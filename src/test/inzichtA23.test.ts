import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TEGELS, schemaWaarde, verandering, groepeer, cumulatiefTegenSchema, periodeStart } from "@/lib/inzicht";

const sql = readFileSync("drizzle/migrations/0205_admin_inzicht_a23.sql", "utf8");
const dashboard = readFileSync("src/components/admin/DashboardStats.tsx", "utf8");
const arr = readFileSync("src/components/admin/ArrOverzicht.tsx", "utf8");

describe("A23 één bron: detail = dashboard", () => {
  it("huidige stand komt uit dashboard_tellers, arr_overzicht en mijn_acties_vandaag", () => {
    expect(sql).toContain("d := public.dashboard_tellers(false)");
    expect(sql).toContain("a := public.arr_overzicht()");
    expect(sql).toContain("d := public.mijn_acties_vandaag(false)");
    for (const [tegel, sleutel] of [["klanten", "klanten"], ["contracten", "contracten_actief"], ["service_open", "service_open"], ["aanvragen", "aanvragen_doel"], ["mrr", "mrr"], ["jaarwaarde", "arr"], ["opzeggingen", "opzeggingen_te_koppelen"]]) {
      expect(sql).toContain(`WHEN '${tegel}' THEN (d->>'${sleutel}')::numeric`);
    }
    expect(sql).toContain("ELSE (a->>'arr_totaal')::numeric");
    expect(sql).toContain("WHEN 'loopt_af' THEN (a->>'arr_loopt_af')::numeric");
  });
  it("momentopname gebruikt dezelfde tel_* functies en zelfde ARR-regel, zonder test", () => {
    for (const f of ["tel_klanten(false)", "tel_contracten(false)", "tel_service_open(false)", "tel_aanvragen_doel(date '2026-10-06')", "tel_netto_groei(_toon_test => false)"]) expect(sql).toContain(f);
    expect(sql).toContain("WHERE status = 'actief' AND is_test = false");
    expect(sql).not.toMatch(/inzicht_tegel\(text\) TO anon/);
  });
  it("elke dashboardtegel opent een bekende detailpagina", () => {
    const hrefs = [...dashboard.matchAll(/\/admin\/inzicht\/(\w+)/g), ...arr.matchAll(/\/admin\/inzicht\/(\w+)/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(13);
    for (const h of hrefs) expect(TEGELS[h], h).toBeDefined();
    for (const k of ["klanten", "contracten", "aanvragen", "service_open", "netto_groei", "arr", "arr_maand", "loopt_af"]) expect(hrefs).toContain(k);
  });
});

describe("A23 meter en grafieken", () => {
  it("schemalijn is 200 x verstreken dagen / 87", () => {
    expect(schemaWaarde("2026-10-06")).toBe(2.3);
    expect(schemaWaarde("2026-10-29")).toBe(55.2);
    expect(schemaWaarde("2026-12-31")).toBe(200);
    expect(schemaWaarde("2027-02-01")).toBe(200);
  });
  it("verandering absoluut en procent, leeg zonder meting", () => {
    expect(verandering(26, 20)).toEqual({ absoluut: 6, procent: 30 });
    expect(verandering(5, 0)).toEqual({ absoluut: 5, procent: null });
    expect(verandering(5, null)).toBeNull();
  });
  it("groepeert gebeurtenissen per week als som en standen als laatste waarde", () => {
    const p = [{ dag: "2026-10-26", waarde: 2 }, { dag: "2026-10-28", waarde: 3 }, { dag: "2026-11-02", waarde: 1 }];
    expect(groepeer(p, "week", "som")).toEqual([{ dag: "2026-10-26", waarde: 5 }, { dag: "2026-11-02", waarde: 1 }]);
    expect(groepeer(p, "maand", "laatste")).toEqual([{ dag: "2026-10-01", waarde: 3 }, { dag: "2026-11-01", waarde: 1 }]);
  });
  it("cumulatief loopt vanaf 6 okt tot vandaag", () => {
    const c = cumulatiefTegenSchema([{ dag: "2026-10-06", waarde: 2 }, { dag: "2026-10-08", waarde: 1 }], "2026-10-08");
    expect(c.map((x) => x.cumulatief)).toEqual([2, 2, 3]);
    expect(periodeStart("30d", "2026-10-29")).toBe("2026-09-30");
  });
});
