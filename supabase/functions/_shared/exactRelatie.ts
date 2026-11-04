// Eén manier om een Exact-relatie (crm/Accounts) te zoeken of aan te maken.
// Gebruikt door lead-to-exact-activate: nieuwe aanvraag (activate) en
// rechtsopvolger zonder relatie (opvolgers_relatie). Zoeken is alleen GET;
// aanmaken is uitsluitend een Accounts-POST (geen contact, bank, mandaat of factuur).
// deno-lint-ignore-file no-explicit-any

export type ExactRelatie = { ID: string; Code: string | null; Name: string | null; ChamberOfCommerce: string | null };

const RECHTSVORM = /\b(b\.?\s?v\.?|v\.?o\.?f\.?|n\.?v\.?|holding|eenmanszaak|c\.?v\.?)\s*$/i;

/** Naam voor vergelijken: kleine letters, gelijke quotes/spaties, rechtsvorm achteraan weg. */
export function relatieNaamKern(naam: unknown): string {
  let s = String(naam ?? "").toLowerCase().replace(/[\u2018\u2019`´]/g, "'").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) s = s.replace(RECHTSVORM, "").replace(/[\s,.-]+$/, "").trim();
  return s;
}

const odata = (s: string) => s.replace(/'/g, "''");

export type RelatieBesluit =
  | { soort: "koppelen"; relatie: ExactRelatie; reden: "kvk" | "naam" }
  | { soort: "aanmaken" }
  | { soort: "handmatig"; reden: string; kandidaten: ExactRelatie[] };

/**
 * Beslisregel na de leescontrole. KvK-match wint; anders precies één relatie met
 * dezelfde naamkern. Relaties in `uitsluiten` (bijv. die van de voorganger) tellen nooit mee.
 */
export function besluitRelatie(input: { kvk: string; naam: string; kvkTreffers: ExactRelatie[]; naamTreffers: ExactRelatie[]; uitsluiten?: string[] }): RelatieBesluit {
  const uit = new Set((input.uitsluiten ?? []).map((x) => x.toLowerCase()));
  const toegestaan = (r: ExactRelatie) => !!r?.ID && !uit.has(String(r.ID).toLowerCase());
  const kvk = input.kvkTreffers.filter(toegestaan).filter((r) => String(r.ChamberOfCommerce ?? "").trim() === input.kvk);
  if (kvk.length === 1) return { soort: "koppelen", relatie: kvk[0], reden: "kvk" };
  if (kvk.length > 1) return { soort: "handmatig", reden: "meerdere relaties met dit KvK-nummer", kandidaten: kvk };
  const kern = relatieNaamKern(input.naam);
  const naam = input.naamTreffers.filter(toegestaan).filter((r) => kern && relatieNaamKern(r.Name) === kern);
  // Een naamgenoot met een ander KvK-nummer is een andere onderneming.
  const zonderAnderKvk = naam.filter((r) => !r.ChamberOfCommerce || String(r.ChamberOfCommerce).trim() === input.kvk);
  if (zonderAnderKvk.length === 1) return { soort: "koppelen", relatie: zonderAnderKvk[0], reden: "naam" };
  if (zonderAnderKvk.length > 1) return { soort: "handmatig", reden: "meerdere relaties met dezelfde naam", kandidaten: zonderAnderKvk };
  return { soort: "aanmaken" };
}

async function lijst(res: Response): Promise<any[]> {
  if (!res.ok) throw new Error(`Exact GET ${res.status}`);
  const j = await res.json().catch(() => ({}));
  return Array.isArray(j?.d?.results) ? j.d.results : Array.isArray(j?.d) ? j.d : [];
}

const SEL = "$select=ID,Code,Name,ChamberOfCommerce";

/** Alleen GET: relaties met dit KvK-nummer. */
export async function zoekRelatiesOpKvk(baseUrl: string, div: string | number, token: string, kvk: string): Promise<ExactRelatie[]> {
  return await lijst(await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts?${SEL}&$filter=ChamberOfCommerce eq '${odata(kvk)}'&$top=5`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }));
}

/** Alleen GET: relaties waarvan de naam de naamkern bevat. */
export async function zoekRelatiesOpNaam(baseUrl: string, div: string | number, token: string, naam: string): Promise<ExactRelatie[]> {
  const kern = relatieNaamKern(naam);
  if (kern.length < 3) return [];
  return await lijst(await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts?${SEL}&$filter=substringof('${odata(kern)}',tolower(Name)) eq true&$top=20`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }));
}

/** Alleen GET: één relatie met adresvelden (voor overnemen naar een opvolger). */
export async function leesRelatie(baseUrl: string, div: string | number, token: string, id: string): Promise<any | null> {
  const r = await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts(guid'${id}')?$select=ID,Code,Name,Email,Phone,AddressLine1,Postcode,City,Country`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j?.d?.results?.[0] ?? j?.d ?? null;
}

/** De enige Accounts-POST. Leest de Code terug als Exact die niet meestuurt. */
export async function maakRelatie(baseUrl: string, div: string | number, token: string, payload: Record<string, unknown>):
  Promise<{ ok: true; id: string; code: string | null } | { ok: false; res: Response }> {
  const res = await fetch(`${baseUrl}/api/v1/${div}/crm/Accounts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, res };
  const d = await res.json().catch(() => ({}));
  const id = d?.d?.ID || d?.ID;
  if (!id) return { ok: false, res: new Response(JSON.stringify(d), { status: 502 }) };
  let code = String(d?.d?.Code ?? d?.Code ?? "").trim() || null;
  if (!code) code = String((await leesRelatie(baseUrl, div, token, id))?.Code ?? "").trim() || null;
  return { ok: true, id, code };
}

/** Accounts-payload voor een rechtsopvolger: naam/KvK van de opvolger, contactgegevens van de voorganger. */
export function opvolgerPayload(opvolger: { naam: string; kvk: string }, voorganger: any, info: { voorgangerNaam: string; ingangsdatum: string | null }) {
  const p: Record<string, unknown> = {
    Name: opvolger.naam, ChamberOfCommerce: opvolger.kvk, Status: "C", IsSales: true,
    Remarks: `Rechtsopvolger van ${info.voorgangerNaam}${voorganger?.Code ? ` (relatie ${String(voorganger.Code).trim()})` : ""}${info.ingangsdatum ? ` per ${info.ingangsdatum}` : ""}. Aangemaakt via zpzaken.nl.`,
  };
  for (const k of ["Email", "Phone", "AddressLine1", "Postcode", "City", "Country"]) if (voorganger?.[k]) p[k] = voorganger[k];
  if (!p.Country) p.Country = "NL";
  return p;
}
