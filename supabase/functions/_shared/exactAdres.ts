// Adres van een bestaande Exact-relatie bijwerken (akkoord Boy 12-11-2026 13:50).
// Strikte allowlist: alleen GET, en PUT crm/Accounts(guid'...') met uitsluitend AddressLine1, Postcode, City, Country.
// Nooit naam, IBAN, e-mail, telefoon of andere velden. Geen imports: ook getest met vitest (src/test/exactAdres1211.test.ts).
// deno-lint-ignore-file no-explicit-any
export type Exact = (methode: "GET" | "PUT", pad: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; data: any; tekst: string }>;
export const ADRES_VELDEN = ["AddressLine1", "Postcode", "City", "Country"] as const;
export type ExactAdres = { AddressLine1: string; Postcode: string; City: string; Country: string };
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function controleerAdresSchrijfactie(methode: string, pad: string, body?: Record<string, unknown>) {
  if (methode === "GET") return;
  const sleutels = Object.keys(body ?? {});
  const m = pad.match(/^crm\/Accounts\(guid'([0-9a-f-]{36})'\)$/i);
  if (methode === "PUT" && m && GUID.test(m[1]) && sleutels.length > 0 && sleutels.every((k) => (ADRES_VELDEN as readonly string[]).includes(k))
    && sleutels.every((k) => typeof body![k] === "string" && String(body![k]).trim() !== "")) return;
  throw new Error(`Niet toegestane Exact-schrijfactie: ${methode} ${pad} [${sleutels.join(",")}]`);
}
export const beveiligdAdres = (ruw: Exact): Exact => async (methode, pad, body) => { controleerAdresSchrijfactie(methode, pad, body); return await ruw(methode, pad, body); };

const schoon = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const NL_PC = /^([1-9][0-9]{3})\s?([A-Za-z]{2})$/;

/** Adres bij ons naar Exact-velden; twijfel = niet automatisch bijwerken. */
export function adresVoorExact(o: { straat?: string | null; huisnummer?: string | null; postcode?: string | null; plaats?: string | null }):
  { adres: ExactAdres } | { twijfel: string } {
  const straat = schoon(o.straat), nr = schoon(o.huisnummer), pc = schoon(o.postcode), plaats = schoon(o.plaats);
  if (!straat || !nr || !pc || !plaats) return { twijfel: "adres bij ons is niet volledig" };
  const m = pc.match(NL_PC);
  if (!m) return { twijfel: "postcode is geen Nederlandse postcode" };
  if (!/^[0-9]/.test(nr)) return { twijfel: "huisnummer begint niet met een cijfer" };
  if (/[0-9]/.test(straat)) return { twijfel: "straatnaam bevat cijfers (mogelijk dubbel huisnummer)" };
  const regel = `${straat} ${nr}`;
  if (regel.length > 100 || plaats.length > 50) return { twijfel: "adres te lang voor Exact" };
  return { adres: { AddressLine1: regel, Postcode: `${m[1]} ${m[2].toUpperCase()}`, City: plaats, Country: "NL" } };
}

const vgl = (v: unknown) => schoon(v).toLowerCase().replace(/\s/g, "");
export function adresGelijk(exact: any, adres: ExactAdres): boolean {
  return ADRES_VELDEN.every((k) => vgl(exact?.[k]) === vgl(adres[k]));
}
export const exactAdresUit = (a: any) => ({ AddressLine1: a?.AddressLine1 ?? null, Postcode: a?.Postcode ?? null, City: a?.City ?? null, Country: a?.Country ?? null });

export type Uitkomst = { status: "bijgewerkt" | "gelijk" | "twijfel" | "fout" | "droog_bijwerken"; oud: any; nieuw: ExactAdres | null; melding: string; terug?: any };
const kort = (r: { status: number; tekst: string }, wat: string) => `${wat} ${r.status}: ${String(r.tekst ?? "").slice(0, 300)}`;

/** Eén relatie: GET, vergelijk, (live) PUT met alleen adresvelden, daarna teruglezen. */
export async function verwerkAdres(ex: Exact, accountId: string, onderneming: any, live: boolean): Promise<Uitkomst> {
  if (!GUID.test(accountId ?? "")) return { status: "fout", oud: null, nieuw: null, melding: "ongeldig Exact-account-ID" };
  const pad = `crm/Accounts(guid'${accountId}')`;
  const sel = `?$select=ID,AddressLine1,Postcode,City,Country`;
  const g = await ex("GET", pad + sel);
  if (!g.ok) return { status: "fout", oud: null, nieuw: null, melding: kort(g, "GET relatie") };
  const oud = exactAdresUit(g.data?.d ?? g.data);
  const a = adresVoorExact(onderneming);
  if ("twijfel" in a) return { status: "twijfel", oud, nieuw: null, melding: a.twijfel };
  if (adresGelijk(oud, a.adres)) return { status: "gelijk", oud, nieuw: a.adres, melding: "adres in Exact is al gelijk" };
  if (!live) return { status: "droog_bijwerken", oud, nieuw: a.adres, melding: "zou adres bijwerken" };
  const p = await ex("PUT", pad, { ...a.adres });
  if (!p.ok) return { status: "fout", oud, nieuw: a.adres, melding: kort(p, "PUT adres") };
  const t = await ex("GET", pad + sel);
  if (!t.ok) return { status: "fout", oud, nieuw: a.adres, melding: kort(t, "GET terugleescontrole") };
  const terug = exactAdresUit(t.data?.d ?? t.data);
  if (!adresGelijk(terug, a.adres)) return { status: "fout", oud, nieuw: a.adres, terug, melding: "terugleescontrole wijkt af" };
  return { status: "bijgewerkt", oud, nieuw: a.adres, terug, melding: "adres bijgewerkt en teruggelezen" };
}
