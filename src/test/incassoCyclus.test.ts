// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { welkeStap, stapVandaag, STAP_DAG, nieuweBeltaakNodig } from "@/lib/incassoCyclus";

const sql = readFileSync("drizzle/migrations/0144_0144_klantmails_incasso_prolongatie.sql", "utf8");

describe("incassocyclus", () => {
  it("welkeStap: drempels 0, 14, 28, 42", () => {
    expect(welkeStap(-1)).toBeNull();
    expect(STAP_DAG[welkeStap(0)!]).toBe(0); expect(STAP_DAG[welkeStap(13)!]).toBe(0);
    expect(STAP_DAG[welkeStap(14)!]).toBe(14); expect(STAP_DAG[welkeStap(28)!]).toBe(28);
    expect(STAP_DAG[welkeStap(42)!]).toBe(42); expect(STAP_DAG[welkeStap(100)!]).toBe(42);
  });
  it("idempotent: een gedane stap wordt niet opnieuw uitgevoerd", () => {
    expect(stapVandaag({ status: "open", dagen: 3, gedaan: [] })?.stap).toBe("herinnering_1");
    expect(stapVandaag({ status: "open", dagen: 3, gedaan: ["herinnering_1"] })).toBeNull();
    expect(sql).toContain("UNIQUE (incasso_id, stap)");
    expect(sql).toContain("ON CONFLICT (incasso_id, stap) DO NOTHING");
  });
  it("stopt na betaald", () => {
    expect(stapVandaag({ status: "betaald", dagen: 20, gedaan: ["herinnering_1"] })).toBeNull();
    expect(sql).toContain("WHERE m.status = 'open' LOOP");
  });
  it("dag 28 schort op; dag 42 maakt alleen een voorstel en royeert niet", () => {
    expect(stapVandaag({ status: "open", dagen: 28, gedaan: [] })).toMatchObject({ opschorten: true, royeren: false });
    expect(stapVandaag({ status: "open", dagen: 42, gedaan: [] })).toMatchObject({ royementVoorstel: true, royeren: false });
    const engine = sql.slice(sql.indexOf("FUNCTION public.incasso_cyclus_stap"), sql.indexOf("FUNCTION public.prolongatie_kandidaten"));
    expect(engine).toContain("status = 'royement_voorgesteld'");
    expect(engine).not.toContain("'geroyeerd'");
    expect(engine).not.toMatch(/klant_contracten|crm_beeindig|eind_datum/);
  });
});

describe("geen dubbele beltaak", () => {
  it("pure helper en SQL", () => {
    const open = [{ soort: "incasso_mislukt_bellen", status: "open", onderneming_id: "o1", factuurnummer: "26001" }];
    expect(nieuweBeltaakNodig(open, "o1", "26001")).toBe(false);
    expect(nieuweBeltaakNodig(open, "o1", "26002")).toBe(true);
    expect(nieuweBeltaakNodig([{ ...open[0], status: "afgerond" }], "o1", "26001")).toBe(true);
    expect(sql).toContain("WHERE soort = 'incasso_mislukt_bellen' AND status = 'open' AND onderneming_id = o.id AND details->>'factuurnummer' = v_nr");
    expect(sql).toContain("CREATE UNIQUE INDEX incasso_mislukt_uniek_open ON public.incasso_mislukt (onderneming_id, factuurnummer) WHERE status = 'open'");
  });
});

describe("incasso-detectie-exact is alleen-lezen", () => {
  it("geen POST, PUT, PATCH of DELETE", () => {
    const s = readFileSync("supabase/functions/incasso-detectie-exact/index.ts", "utf8");
    expect(s).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect(s).not.toMatch(/\b(POST|PUT|DELETE)\b/);
    expect(s).toContain('method: "GET"');
    expect(s).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(s).not.toContain("meld_incasso_mislukt\"");
  });
});
