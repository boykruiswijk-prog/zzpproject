// Server-side test met mocks: geen echte database, KVK of mail. Vangt de handler via een gestubde Deno.serve.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://mock.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock");
Deno.env.set("RESEND_API_KEY", "");

const aanroepen: string[] = [];
const opgeslagen: Record<string, unknown>[] = [];
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  aanroepen.push(`${method} ${url}`);
  if (method === "POST" && url.includes("/rest/v1/leads")) opgeslagen.push(JSON.parse(String(init?.body ?? "{}")));
  if (!url.startsWith("http://mock.local")) return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  const accept = new Headers(init?.headers).get("accept") ?? "";
  const enkel = accept.includes("vnd.pgrst.object");
  if (url.includes("/rpc/")) return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  if (method === "GET" || method === "HEAD") return new Response(enkel ? "null" : "[]", { status: 200, headers: { "content-type": "application/json", "content-range": "0-0/0" } });
  // insert/update: geef een rij terug met een id
  return new Response(enkel ? '{"id":"00000000-0000-4000-8000-000000000001"}' : '[{"id":"00000000-0000-4000-8000-000000000001"}]', { status: 201, headers: { "content-type": "application/json" } });
}) as typeof fetch;

let handler: ((req: Request) => Promise<Response>) | null = null;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => { handler = typeof h === "function" ? h : h.handler; return { finished: Promise.resolve() }; };
await import("./index.ts");

const morgen = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const geldig = () => ({
  hp: "", ms: 60_000, gekozen_pakket: "maandelijks", cyber_aangevraagd: false, cyber_antwoorden: {}, cyber_akkoord: false, cyber_client_akkoord_op: null,
  betaalwijze: "maandelijks", ingangsdatum: morgen, voornaam: "Test", achternaam: "Agent", email: "test.ads-agent@zpzaken.nl", telefoon: "0612345678",
  attributie: {}, bedrijfsnaam: "Test Agent BV", kvk_nummer: "34567891", kvk_startdatum: null, beroep: "Consultant", sector: "ICT",
  // Adres komt nu uit stap 4, maar met dezelfde veldnamen.
  adres_straat: "Tupolevlaan", adres_huisnummer: "41", adres_postcode: "1119 NW", adres_plaats: "Schiphol-Rijk", adres_land: "Nederland",
  iban: "NL91ABNA0417164300", sepa_akkoord: true, rekeninghouder: "Test Agent BV", lead_id: crypto.randomUUID(),
  client_akkoord_op: new Date().toISOString(), pagina_url: "http://localhost/", formulier_naam: "Online aanvraag BAV + AVB", formulier: [],
  getoonde_documenten: [], vereist_handmatige_beoordeling: false, opmerkingen: null,
});
const post = (body: unknown) => { if (!handler) throw new Error("Handler missing"); return handler(new Request("http://localhost:8080/functions/v1/process-bav-wizard", {
  method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:8080" }, body: JSON.stringify(body),
})); };

Deno.test({ name: "placeholder-KVK wordt geweigerd (400)", sanitizeOps: false, sanitizeResources: false }, async () => {
  for (const kvk of ["12345678", "11111111"]) {
    const res = await post({ ...geldig(), kvk_nummer: kvk });
    const j = await res.json();
    assertEquals(res.status, 400);
    assertEquals(String(j.error ?? j.message).includes("Vul je eigen KVK-nummer in (8 cijfers)"), true);
  }
});

Deno.test({ name: "volledige geldige payload na verhuizing adres wordt geaccepteerd (200)", sanitizeOps: false, sanitizeResources: false }, async () => {
  const res = await post(geldig());
  const txt = await res.text();
  if (res.status !== 200) console.log(txt.slice(0, 500));
  assertEquals(res.status, 200);
  assertEquals(aanroepen.some((a) => a.includes("api.resend.com")), false);
});

Deno.test({ name: "realistische invoer (accent, tussenvoegsel, & en +, spaties, buitenland, lange tekst) wordt geaccepteerd", sanitizeOps: false, sanitizeResources: false }, async () => {
  const res = await post({
    ...geldig(), lead_id: crypto.randomUUID(),
    voornaam: "Anne-Marie", achternaam: "van 't Hoff-Çelik", rekeninghouder: "Anne-Marie van 't Hoff-Çelik",
    bedrijfsnaam: "Hoff & Çelik Consultancy + Partners", kvk_nummer: "6211 7092", iban: "NL91 ABNA 0417 1643 00",
    adres_straat: "Rue de la Loi", adres_huisnummer: "16", adres_postcode: "B-1000", adres_plaats: "Bruxelles", adres_land: "België",
    opmerkingen: "Ik werk als interim-manager voor zorg & overheid (> 3 opdrachtgevers). ".repeat(40),
  });
  const txt = await res.text();
  if (res.status !== 200) console.log(txt.slice(0, 500));
  assertEquals(res.status, 200);
  assertEquals(aanroepen.some((a) => a.includes("api.resend.com")), false);
});

Deno.test({ name: "werkzaamheden: 50, 999, 1000 volledig opgeslagen; 1500 geweigerd vóór alle writes", sanitizeOps: false, sanitizeResources: false }, async () => {
  for (const n of [50, 999, 1000, 1500]) {
    aanroepen.length = 0;
    const response = await post({ ...geldig(), beroep: "a".repeat(n) });
    const body = await response.json();
    assertEquals(response.status, n <= 1000 ? 200 : 400);
    if (n <= 1000) assertEquals(opgeslagen.at(-1)?.beroep, "a".repeat(n));
    if (n > 1000) {
      assertEquals(body.field, "beroep");
      assertEquals(body.error.includes("maximaal 1.000 tekens"), true);
      assertEquals(aanroepen.length, 0);
    }
  }
});

Deno.test({ name: "zorg, bouw en andere handmatige markering: ontvangst zonder mandaatkenmerk", sanitizeOps: false, sanitizeResources: false }, async () => {
  for (const data of [{ sector: "Zorg" }, { sector: "Bouw & techniek" }, { vereist_handmatige_beoordeling: true }]) {
    const response = await post({ ...geldig(), ...data });
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.handmatige_beoordeling, true);
    assertEquals(body.mandaatkenmerk, undefined);
    assertEquals(aanroepen.some(a => a.includes("api.resend.com")), false);
  }
});
