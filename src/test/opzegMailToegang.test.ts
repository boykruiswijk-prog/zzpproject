// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { verstuurKlantmail } from "../../supabase/functions/_shared/klantmailSchakelaar";

const id = "00000000-0000-4000-8000-000000000001";
const env = { INTERNAL_FUNCTION_SECRET: "mock-internal", SUPABASE_SERVICE_ROLE_KEY: "mock-service", RESEND_API_KEY: "mock-mail" };
const runtime = { env: { get: (key: string) => env[key as keyof typeof env] } };
const compile = (path: string) => ts.transpileModule(readFileSync(path, "utf8").replace(/^import .*;\r?\n/gm, ""), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const token = (aal: string, role = "authenticated") => `header.${btoa(JSON.stringify({ aal, role }))}.signature`;
const request = (authorization: string, body: object, secret?: string) => new Request("https://example.test", {
  method: "POST", headers: { Authorization: `Bearer ${authorization}`, "Content-Type": "application/json", ...(secret ? { "x-internal-secret": secret } : {}) }, body: JSON.stringify(body),
});

function fixture(name: string, status = "geroyeerd") {
  const writes = vi.fn(); const send = vi.fn(async () => "zou_verzenden"); const fetchSpy = vi.fn();
  const db = { from: (table: string) => {
    const row = table === "incasso_mislukt" ? { id, status, geroyeerd_op: "2026-10-19", is_test: false, onderneming_id: id, lead_id: id, bedrag: 55 }
      : table === "crm_notities" ? { id, soort: "stop", details: { einddatum: "2026-10-19" }, is_test: false, onderneming_id: id }
      : table === "ondernemingen" ? { naam: "Test" } : null;
    const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: row }),
      insert: writes, update: writes, upsert: writes, then: (resolve: any) => resolve({ data: [{ personen: { email_weergave: "test@zpzaken.nl", voornaam: "Test" } }] }) };
    return api;
  }, rpc: vi.fn(async () => ({ data: true })) };
  const auth: any = {};
  new Function("exports", "createClient", "corsHeaders", "Deno", compile("supabase/functions/_shared/teamAuth.ts"))(
    auth, () => ({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) } }), { "Access-Control-Allow-Origin": "*" }, runtime);
  let handler: ((req: Request) => Promise<Response>) | undefined;
  new Function("exports", "Deno", "createClient", "corsHeaders", "isInternalMachine", "requireMfa", "requireSupervisor", "createMailGate", "COMPANY", "klantOntvanger", "verstuurKlantmail", "datumNL", "euro", "fetch",
    compile(`supabase/functions/${name}/index.ts`))({}, { ...runtime, serve: (fn: typeof handler) => { handler = fn; } }, () => db,
    { "Access-Control-Allow-Origin": "*" }, auth.isInternalMachine, auth.requireMfa, auth.requireSupervisor,
    () => ({ plan: () => ({ send: true, to: ["test@zpzaken.nl"] }) }), { legalName: "ZP Zaken" },
    async () => ({ email: "test@zpzaken.nl", voornaam: "Test" }), send, (s: string) => s, String, fetchSpy);
  return { handler: async (req: Request) => { if (!handler) throw new Error("Missing handler"); return handler(req); }, writes, send, fetchSpy };
}
afterEach(() => vi.unstubAllGlobals());

describe("Opzegging en royementsmail: veilige toegang en droge run", () => {
  for (const name of ["crm-beeindiging-bevestiging", "royement-bevestiging-mail"]) {
    const body = { notitie_id: id, incasso_id: id, dry_run: true };
    it(`${name}: aal1 gets a structured MFA step before any mail or write`, async () => {
      const f = fixture(name); const res = await f.handler(request(token("aal1"), body));
      expect(res.status).toBe(403); expect(await res.json()).toEqual({ error: "mfa_required" });
      expect(f.writes).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled(); expect(f.fetchSpy).not.toHaveBeenCalled();
    });
    for (const mode of ["aal2", "internal", "service"]) {
      it(`${name}: ${mode} reaches mail readiness without mail or writes`, async () => {
        const f = fixture(name); const res = await f.handler(request(mode === "service" ? "mock-service" : token(mode === "aal2" ? "aal2" : "aal1"), body, mode === "internal" ? "mock-internal" : undefined));
        expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ dry_run: true, would_send: true });
        expect(f.writes).not.toHaveBeenCalled(); expect(f.fetchSpy).not.toHaveBeenCalled();
        if (name === "royement-bevestiging-mail") expect(f.send).toHaveBeenCalledWith(expect.anything(), expect.anything(), name, "royement_bevestiging", "test@zpzaken.nl", expect.anything(), {}, { dryRun: true });
      });
    }
    it(`${name}: forged service role and wrong internal secret cannot skip MFA`, async () => {
      const f = fixture(name); const res = await f.handler(request(token("aal1", "service_role"), body, "wrong"));
      expect(res.status).toBe(403); await res.text(); expect(f.writes).not.toHaveBeenCalled();
    });
  }
  it("royementsmail refuses an unconfirmed royement", async () => {
    const f = fixture("royement-bevestiging-mail", "royement_voorgesteld");
    const res = await f.handler(request("mock-service", { incasso_id: id, dry_run: true }));
    expect(res.status).toBe(409); await res.text(); expect(f.send).not.toHaveBeenCalled(); expect(f.writes).not.toHaveBeenCalled();
  });
  it("real mail helper dry run respects approval without fetching or logging", async () => {
    vi.stubGlobal("Deno", runtime); const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    for (const actief of [true, false]) {
      const insert = vi.fn(); const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: { actief, status: "goedgekeurd_boy", onderwerp: "Test", tekst: "Test {voornaam}" } }), insert };
      const result = await verstuurKlantmail({ from: () => api }, null, "royement-bevestiging-mail", "royement_bevestiging", "test@zpzaken.nl", { voornaam: "Test" }, {}, { dryRun: true });
      expect(result).toBe(actief ? "zou_verzenden" : "niet_verzonden_schakelaar_uit"); expect(insert).not.toHaveBeenCalled();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});