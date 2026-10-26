// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const root = "supabase/functions";
// These functions have no privileged human team path. Mixed functions are NOT exempt.
const uitzonderingen: Record<string, string> = {
  "aanvraag-nabellen": "Vault cron-secret",
  "afgehaakt-samenvatting": "Vault cron-secret",
  "artikel-foto": "Empty wake processes only SQL-enqueued article photo jobs; no caller input",
  "auth-email-hook": "Verified webhook signature/provider credential",
  "exact-gl-check": "Vault cron-secret only",
  "exact-keepalive": "Vault cron-secret only",
  "exact-oauth-callback": "Single-use OAuth state issued by MFA-protected exact-oauth-start",
  "get-customer-invoices": "Customer JWT with account ownership",
  "get-invoice-pdf": "Customer JWT with invoice ownership",
  "kvk-api-status": "Public boolean availability only",
  "kvk-uittreksel-upload": "Public guarded application upload with file and concept validation",
  "login-guard": "Pre-login brute-force protection",
  "mcp": "Public read-only knowledge/services",
  "otentica-webhook": "Provider HMAC signature or provider secret",
  "polis-reminder-cron": "Vault cron-secret only",
  "portal-invite-login": "Customer invitation token",
  "process-bav-wizard": "Public application with spam guard",
  "process-email-queue": "Service-role machine token only",
  "process-klant-service": "Public guarded customer request; team users explicitly rejected",
  "process-screening-aanvraag": "Public application with spam guard",
  "review-afmelden": "Individual unsubscribe token",
  "review-klik": "Individual review token",
  "review-verzoeken": "Vault cron-secret only",
  "send-notification": "Internal-secret or restricted recent public lead notification",
  "send-portal-magiclink": "Rate-limited customer login request",
  "sitemap": "Public published article URLs",
  "submit-public-form": "Validated public forms with rate limit and honeypot",
  "wijziging-mailen": "Vault cron-secret only",
  "zeker-chat": "Rate-limited public chat",
};

function hasGuard(source: string): boolean {
  const file = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
  const guards = new Set<string>();
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const path = node.moduleSpecifier.text;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      const original = binding.propertyName?.text ?? binding.name.text;
      if ((path === "../_shared/teamAuth.ts" && ["requireMfa", "requireSupervisor", "requireVerzekeringOfSupervisor"].includes(original)) ||
        (path === "../_shared/cronOfSupervisor.ts" && original === "cronOfSupervisor")) guards.add(binding.name.text);
    }
  }
  let guarded = false;
  function visit(node: ts.Node) {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) && guards.has(node.expression.expression.text)) {
      const req = node.expression.arguments[0];
      if (req && ts.isIdentifier(req) && req.text === "req") guarded = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return guarded;
}

const functions = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .map((entry) => entry.name).sort();

describe("Every internal human function requires MFA (Boy 19-10-2026)", () => {
  for (const name of functions) {
    it(name, () => {
      const source = readFileSync(`${root}/${name}/index.ts`, "utf8");
      if (uitzonderingen[name]) {
        expect(uitzonderingen[name].length).toBeGreaterThan(10);
        // A role guard in an exception signals a newly introduced team path.
        if (name === "process-klant-service") {
          expect(source).toMatch(/if \(isTeam === true\) return new Response/);
        } else {
          expect(source).not.toMatch(/is_team_member|is_supervisor_or_admin|mag_crm_beeindigen|\.from\(["']user_roles["']\)/);
        }
      } else if (name === "klant-document-versturen") {
        // Existing validated JWT + AAL2 + team guard, intentionally unchanged.
        expect(source).toContain('await userClient.auth.getUser()');
        expect(source).toContain('if (aal(auth.slice(7).trim()) !== "aal2") return json({ error: "mfa_required" }, 403)');
        expect(source).toContain('admin.rpc("is_team_member"');
      } else {
        expect(hasGuard(source), `${name}: shared MFA guard must be awaited, not only imported`).toBe(true);
        expect(source).toMatch(/instanceof Response/);
      }
    });
  }
  it("exception list contains no obsolete functions", () => {
    expect(Object.keys(uitzonderingen).filter((name) => !functions.includes(name))).toEqual([]);
  });
  it("detects missing, commented and unawaited guards", () => {
    expect(hasGuard('import { requireMfa } from "../_shared/teamAuth.ts"; // await requireMfa(req)')).toBe(false);
    expect(hasGuard('import { requireMfa } from "../_shared/teamAuth.ts"; requireMfa(req);')).toBe(false);
    expect(hasGuard('await requireMfa(req);')).toBe(false);
  });
});

// Run the actual shared source with only the SDK and environment mocked. No network or secrets.
function loadAuth(getUser: ReturnType<typeof vi.fn>) {
  const source = readFileSync(`${root}/_shared/teamAuth.ts`, "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (req: Request, admin?: unknown) => Promise<{ userId: string } | Response>> = {};
  new Function("exports", "createClient", "corsHeaders", "Deno", compiled)(exports,
    () => ({ auth: { getUser } }), { "Access-Control-Allow-Origin": "*" }, { env: { get: () => "mock" } });
  return exports;
}
const request = (aal: string) => new Request("https://example.test", {
  headers: { Authorization: `Bearer header.${btoa(JSON.stringify({ aal }))}.signature` },
});
describe("Shared MFA enforces authenticated aal2", () => {
  it("rejects no session with 401 and CORS", async () => {
    const getUser = vi.fn(); const auth = loadAuth(getUser);
    const result = await auth.requireMfa(new Request("https://example.test"));
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error("Expected rejection");
    expect(result.status).toBe(401); expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await result.json()).toEqual({ error: "unauthorized" }); expect(getUser).not.toHaveBeenCalled();
  });
  it("rejects forged aal2 if SDK validation fails", async () => {
    const auth = loadAuth(vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } }));
    const result = await auth.requireMfa(request("aal2"));
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error("Expected rejection");
    expect(result.status).toBe(401); await result.text();
  });
  it("rejects valid aal1 with mfa_required 403", async () => {
    const auth = loadAuth(vi.fn().mockResolvedValue({ data: { user: { id: "supervisor" } }, error: null }));
    const result = await auth.requireMfa(request("aal1"));
    if (!(result instanceof Response)) throw new Error("Expected MFA rejection");
    expect(result.status).toBe(403); expect(await result.json()).toEqual({ error: "mfa_required" });
  });
  it("admits valid aal2 and preserves the supervisor role check", async () => {
    const auth = loadAuth(vi.fn().mockResolvedValue({ data: { user: { id: "supervisor" } }, error: null }));
    expect(await auth.requireMfa(request("aal2"))).toEqual({ userId: "supervisor" });
    const rpc = vi.fn().mockResolvedValue({ data: true });
    expect(await auth.requireSupervisor(request("aal2"), { rpc })).toEqual({ userId: "supervisor" });
    expect(rpc).toHaveBeenCalledWith("is_supervisor_or_admin", { _user_id: "supervisor" });
  });
  it("MFA does not grant supervisor rights to a non-supervisor", async () => {
    const auth = loadAuth(vi.fn().mockResolvedValue({ data: { user: { id: "customer" } }, error: null }));
    const result = await auth.requireSupervisor(request("aal2"), { rpc: vi.fn().mockResolvedValue({ data: false }) });
    if (!(result instanceof Response)) throw new Error("Expected role rejection");
    expect(result.status).toBe(403); expect(await result.json()).toEqual({ error: "forbidden" });
  });
});