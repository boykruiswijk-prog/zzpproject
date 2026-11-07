// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { bereidPlannerCredits, heeftPlannerWerk, plannerDroogRapport } from "../../supabase/functions/_shared/plannerVoorbereiding";
import { startNlDagIso } from "../../supabase/functions/_shared/plannerBatch";

const credit = { id: "c", creditsleutel: "ZPC-0E5D7316", bron: "correctie", status: "te_maken", bedrag: 60, berekening: { jaarpremie: 600, korting_pct: 10 }, planning_ids: ["p"], einddatum: "2026-10-19", credit_vanaf: "2026-10-20", credit_tm: "2027-10-19", origineel_factuurnummer: "26700072", exact_account_id: "account", exact_item_id: "item", gl_code: "8003", is_test: false };
const periode = { periode_start: "2026-10-20", periode_eind: "2027-10-19", bedrag: 600, btw_code: "0" };
function mockAdmin(rijen: unknown[] = [], credits: unknown[] = [], start: string | null = "run") {
  const mutations = vi.fn(); const rpc = vi.fn(async (name: string) => ({ data: name === "facturatie_kandidaten" ? rijen : name === "factuur_planner_start" ? start : 0 }));
  const from = (table: string) => {
    const values = table === "factuur_credit_planning" ? credits : table === "factuur_planning" ? [periode] : table === "facturatie_config" ? { facturatie_actief: true, opzeg_credits_actief: true } : {};
    const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: values }), update: (...args: unknown[]) => { mutations(table, ...args); return q; }, then: (resolve: any) => Promise.resolve({ data: values }).then(resolve) };
    return q;
  };
  return { from, rpc, mutations };
}
async function handler(admin: ReturnType<typeof mockAdmin>) {
  let serve: any;
  const mail = vi.fn(() => { throw new Error("mail forbidden"); }); const exact = vi.fn(() => { throw new Error("Exact forbidden"); });
  const source = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8").replace(/^import .*;\n/gm, "");
  const code = transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.None } }).outputText;
  runInNewContext(code, { Deno: { serve: (fn: any) => { serve = fn; }, env: { get: (k: string) => k === "INTERNAL_FUNCTION_SECRET" ? "test-secret" : "test-config" } },
    createClient: () => admin, metWerk: (_cfg: unknown, fn: any) => fn, metExactMelding: (_name: string, fn: any) => fn, werkVan: () => ({ start: vi.fn() }), requireSupervisor: vi.fn(), isServiceTestRequest: () => false,
    bereidPlannerCredits, heeftPlannerWerk, plannerDroogRapport, startNlDagIso, Request, Response, Intl, URL, fetch: exact,
    verstuurInterneMelding: mail, sendExactAlarm: mail, sendPlannerFoutMelding: mail });
  return { serve, mail, exact };
}
describe("A33 effect-free planner", () => {
  it("full dry run preserves 60, reports it and causes zero mutations, Exact or mails", async () => {
    const admin = mockAdmin([], [credit]); const h = await handler(admin);
    const response = await h.serve(new Request("https://example.test", { method: "POST", headers: { "x-internal-secret": "test-secret" }, body: JSON.stringify({ actie: "dryrun" }) }));
    const result = await response.json();
    expect(result.samenvatting.credits).toBe(1); expect(result.samenvatting.creditbedrag).toBe(60);
    expect(result.creditnotas[0].sleutel).toBe("ZPC-0E5D7316"); expect(result.creditnotas[0].payload.SalesInvoiceLines[0].UnitPrice).toBe(60);
    expect(admin.mutations).not.toHaveBeenCalled(); expect(h.exact).not.toHaveBeenCalled(); expect(h.mail).not.toHaveBeenCalled();
    expect(admin.rpc.mock.calls.map((c) => c[0])).toEqual(["facturatie_kandidaten"]);
  });
  it("empty real run returns before every Exact and mail path", async () => {
    const admin = mockAdmin(); const h = await handler(admin);
    const response = await h.serve(new Request("https://example.test", { method: "POST", headers: { "x-internal-secret": "test-secret" }, body: '{"actie":"dagrun"}' }));
    expect((await response.json()).leeg).toBe(true); expect(h.exact).not.toHaveBeenCalled(); expect(h.mail).not.toHaveBeenCalled();
  });
  it("rejected sixth run returns before candidate/credit reads or mutations", async () => {
    const admin = mockAdmin([], [], null); const h = await handler(admin);
    const response = await h.serve(new Request("https://example.test", { method: "POST", headers: { "x-internal-secret": "test-secret" }, body: '{"actie":"dagrun"}' }));
    expect((await response.json()).overgeslagen).toBe(true); expect(admin.rpc.mock.calls.map((c) => c[0])).toEqual(["factuur_planner_start"]);
    expect(admin.mutations).not.toHaveBeenCalled(); expect(h.exact).not.toHaveBeenCalled(); expect(h.mail).not.toHaveBeenCalled();
  });
  it("disabled credits and test credits are not work", () => {
    expect(heeftPlannerWerk([], [credit], true, false, "2026-11-07")).toBe(false);
    expect(heeftPlannerWerk([], [{ ...credit, is_test: true }], false, true, "2026-11-07")).toBe(false);
    expect(heeftPlannerWerk([], [credit], false, true, "2026-11-07")).toBe(true);
  });
  it("invoice preview reports the actual discounted amount per contract-period", () => {
    const r = plannerDroogRapport([{ klant_contract_id: "contract", periode_start: "2026-11-07", periode_eind: "2027-11-06", bedrag: 540, aantal: 1, bedrag_per_periode: 540, gl_code: "8003", btw_code: "0" }], [], {}, { facturatie_actief: true }, "2026-11-07");
    expect(r.samenvatting.factuurbedrag).toBe(540); expect(r.facturen[0].sleutel).toBe("contract:2026-11-07"); expect(r.facturen[0].payload?.SalesInvoiceLines[0].UnitPrice).toBe(540);
  });
});
it("database admits exactly five, denies sixth and direct bypass, historical/proef do not count", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
      CREATE FUNCTION is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE factuur_planner_runs(id uuid DEFAULT gen_random_uuid(),gestart_op timestamptz DEFAULT now(),modus text,trigger_type text,aantal_kandidaten int,aantal_geblokkeerd int,bedrag numeric,status text,bijgewerkt_op timestamptz DEFAULT now(),afgerond_op timestamptz,detail jsonb);
      INSERT INTO factuur_planner_runs(modus,gestart_op,status) VALUES ('live',now()-interval '2 days','ok'),('proef',now(),'ok');
      SET test.role='service_role';`);
    await db.exec(readFileSync("drizzle/migrations/0257_planner_a33_waarborgen.sql", "utf8"));
    for (let i = 0; i < 5; i++) {
      expect((await db.query<{ id: string }>("select factuur_planner_start('cron:dagrun',0,0,0) id")).rows[0].id).toBeTruthy();
      await db.exec("update factuur_planner_runs set status='ok'");
    }
    expect((await db.query<{ id: string | null }>("select factuur_planner_start('handmatig:dagrun',0,0,0) id")).rows[0].id).toBeNull();
    await expect(db.exec("insert into factuur_planner_runs(modus,status) values('live','ok')")).rejects.toThrow("maximaal 5");
    expect((await db.query<{ n: number }>("select count(*)::int n from factuur_planner_runs where modus='live' and (gestart_op at time zone 'Europe/Amsterdam')::date=(now() at time zone 'Europe/Amsterdam')::date")).rows[0].n).toBe(5);
    await db.exec("SET test.role='authenticated'");
    await expect(db.query("select factuur_planner_start('manual',0,0,0)")).rejects.toThrow("geen toegang");
  } finally { await db.close(); }
}, 30000);