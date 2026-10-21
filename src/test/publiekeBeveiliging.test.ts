// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { Parser } from "htmlparser2";

function compile(path: string) {
  const source = readFileSync(path, "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = file.statements.filter(ts.isImportDeclaration);
  let withoutImports = source;
  for (const node of [...imports].reverse()) withoutImports = withoutImports.slice(0, node.getFullStart()) + withoutImports.slice(node.end);
  return ts.transpileModule(withoutImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const input: any = {};
new Function("exports", "z", "Parser", compile("supabase/functions/_shared/publiekeInvoer.ts"))(input, z, Parser);
const retired: any = {};
new Function("exports", compile("supabase/functions/_shared/legacyImportStop.ts"))(retired);
const validBav = { gekozen_pakket: "maandelijks", betaalwijze: "maandelijks", ingangsdatum: "2026-10-22",
  voornaam: "Test", achternaam: "Test", email: "test@zpzaken.nl", bedrijfsnaam: "Test" };

describe("Publieke invoer zonder writes of mails", () => {
  it("strips tags and executable content without repeatedly decoding or corrupting comparisons", () => {
    expect(input.gewoneTekst('<b>Test</b><script>alert(1)</script><img src=x onerror=alert(2)>')).toBe("Test");
    expect(input.gewoneTekst('&lt;img src=x onerror=alert(1)&gt;')).not.toContain("<");
    expect(input.gewoneTekst('Test &amp; Partners')).toBe("Test &amp; Partners");
    expect(input.gewoneTekst('omzet <50000 en >10000')).toBe('omzet <50000 en >10000');
    expect(input.gewoneTekst(input.gewoneTekst('Test &amp;amp; Partners'))).toBe('Test &amp;amp; Partners');
  });
  it("keeps SEPA evidence and attribution byte-identical while cleaning display text", () => {
    const proof = '<ongewijzigd bewijs>'; const attribution = { gclid: 'Ab-C_123', marketing_toestemming: true };
    const parsed = input.saneerBavTekst({ ...validBav, opmerkingen: '<b>Vraag</b>', sepa_bewijs: proof,
      iban: 'NL00TEST0000000000', client_akkoord_op: '2026-10-21T10:00:00Z', attributie: attribution });
    expect(parsed.opmerkingen).toBe('Vraag'); expect(parsed.sepa_bewijs).toBe(proof);
    expect(parsed.attributie).toBe(attribution); expect(parsed.iban).toBe('NL00TEST0000000000');
  });
  it.each([null, [], { name: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: {} } } } } } } } } }])("rejects malformed or deeply nested objects", body => {
    expect(input.objectInvoer.safeParse(body).success).toBe(false);
  });
  it.each([{ email: {} }, { voornaam: {} }, { email: "invalid" }, { ingangsdatum: "2026-02-31" }, { sepa_akkoord: "true" }])("rejects invalid BAV types before business processing", change => {
    expect(input.bavInvoer.safeParse({ ...validBav, ...change }).success).toBe(false);
  });
  it("accepts ordinary BAV input and nullable optional fields", () => {
    expect(input.bavInvoer.safeParse({ ...validBav, telefoon: null, kvk_startdatum: null }).success).toBe(true);
  });
  it("preserves email, ordered answers, documents and all consent evidence exactly", () => {
    const body = { ...validBav, email: "a&amp;b@zpzaken.nl", formulier: [{ label: "Omzet", waarde: "<50000 en >10000" }],
      getoonde_documenten: ["/voorwaarden?x=1&y=2"], sepa_akkoord: true, iban: null,
      cyber_client_akkoord_op: null, client_akkoord_op: "2026-10-21T10:00:00Z" };
    expect(input.bavInvoer.safeParse(body).success).toBe(true);
    expect(input.saneerBavTekst(body)).toEqual(body);
    expect(input.saneerVrijeTekst({ ...body, getoonde_tekst: "<bewijs>&amp;", bericht: "<b>Vraag</b>" }))
      .toEqual({ ...body, getoonde_tekst: "<bewijs>&amp;", bericht: "Vraag" });
  });
  it("rejects object-valued contact fields and oversized email", () => {
    expect(input.valideerPubliekeRij({ voornaam: {} })).toBe(false);
    expect(input.valideerPubliekeRij({ email: 'a'.repeat(256) })).toBe(false);
    expect(input.valideerPubliekeRij({ voornaam: 'Test', email: 'test@zpzaken.nl', extra_data: { toestemming: true } })).toBe(true);
  });
  it("bounds actual bytes even without Content-Length", async () => {
    await expect(input.leesBegrensdeBody(new Request('https://example.test', { method: 'POST', body: '12345' }), 4)).rejects.toThrow('body_too_large');
    await expect(input.leesBegrensdeBody(new Request('https://example.test', { method: 'POST', body: '1234' }), 4)).resolves.toBe('1234');
  });
});

function boot(name: string, extra: Record<string, unknown> = {}) {
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const sideEffect = vi.fn(() => { throw new Error('Unexpected side effect'); });
  const db: any = { from: sideEffect, rpc: sideEffect, auth: sideEffect };
  const env: Record<string, string> = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'mock-service',
    SUPABASE_ANON_KEY: 'mock-anon', INTERNAL_FUNCTION_SECRET: 'mock-internal', OTENTICA_WEBHOOK_SECRET: 'mock-provider', LOVABLE_API_KEY: 'mock-mail' };
  const scope: Record<string, unknown> = { ...input, ...retired, ...extra, createClient: () => db,
    corsHeaders: { "Access-Control-Allow-Origin": "*" }, sdkCorsHeaders: { "Access-Control-Allow-Origin": "*" },
    requireMfa: async () => ({ userId: 'mock-team' }),
    Deno: { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    fetch: sideEffect, metWerk: (_: unknown, fn: unknown) => fn,
    aanvraagPremie: () => ({ totaal: 55, maand: true, cyber: false }),
    isToegestaneOrigin: () => true, normaliseerTaal: () => 'nl',
    ZEKER_STANDAARD_GESPREKKEN_PER_DAG: 500, ZEKER_STANDAARD_MODEL: 'mock', ZEKER_MAX_TEKENS: 2000,
    CYBER_DEKKING: '', CYBER_HULP: '', CYBER_POLISVOORWAARDEN: '', legacyRedirectMap: {},
  };
  if (name === 'otentica-webhook') delete scope.corsHeaders;
  new Function('exports', ...Object.keys(scope), compile(`supabase/functions/${name}/index.ts`))({}, ...Object.values(scope));
  return { call: async (req: Request) => { if (!handler) throw new Error('No handler'); return handler(req); }, sideEffect };
}
const req = (body: unknown, headers: Record<string, string> = {}) => new Request('https://example.test', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

describe("Changed endpoints boot and reject without external effects", () => {
  for (const name of ['wp-import', 'image-migrate']) {
    it(`${name} never contacts WordPress, even on dryrun`, async () => {
      const f = boot(name); const res = await f.call(req({ mode: 'dryrun' }));
      expect(res.status).toBe(410); expect(await res.json()).toMatchObject({ error: 'legacy_import_disabled' });
      expect(f.sideEffect).not.toHaveBeenCalled();
    });
  }
  for (const name of ['submit-public-form', 'process-bav-wizard', 'zeker-chat']) {
    it(`${name} rejects malformed payload before any write or mail`, async () => {
      const f = boot(name); const res = await f.call(req(null));
      expect(res.status).toBe(400); expect(f.sideEffect).not.toHaveBeenCalled();
    });
  }
  it("BAV repeat-email cannot switch off the existing spam guard", () => {
    const source = readFileSync('supabase/functions/process-bav-wizard/index.ts', 'utf8');
    expect(source).not.toMatch(/throttle:\s*!vorigeLeadId/);
    expect(source).toMatch(/guardPublicSubmission\(req, supabase, \{\s*throttle: true/);
  });
  it("Otentica rejects invalid signature before parsing or effects", async () => {
    const f = boot('otentica-webhook'); const res = await f.call(req({}, { 'x-otentica-signature': '00' }));
    expect(res.status).toBe(401); expect(f.sideEffect).not.toHaveBeenCalled();
  });
  it("Otentica accepts a signed object without processing or logging its contents", async () => {
    const f = boot('otentica-webhook'); const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const res = await f.call(req({ event: 'test', sensitive: 'not-to-log' }, { 'x-otentica-secret': 'mock-provider' }));
      expect(res.status).toBe(200); expect(f.sideEffect).not.toHaveBeenCalled();
      expect(log.mock.calls.flat().join(' ')).not.toContain('not-to-log');
    } finally { log.mockRestore(); }
  });
  it("Otentica rejects authenticated arrays", async () => {
    const f = boot('otentica-webhook'); const res = await f.call(req([], { 'x-otentica-secret': 'mock-provider' }));
    expect(res.status).toBe(400); expect(f.sideEffect).not.toHaveBeenCalled();
  });
  it("mail queue rejects a forged service-role claim before reads/writes/mail", async () => {
    const f = boot('process-email-queue'); const forged = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.forged`;
    const res = await f.call(req({}, { Authorization: `Bearer ${forged}` }));
    expect(res.status).toBe(403); expect(f.sideEffect).not.toHaveBeenCalled();
  });
});