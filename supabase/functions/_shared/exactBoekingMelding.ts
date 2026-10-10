// Interne controle-melding bij elke schrijfactie (POST/PUT/PATCH/DELETE) van het platform naar Exact Online.
// Werkt door fetch te observeren binnen een request-context (AsyncLocalStorage); de bestaande
// Exact-logica (bedragen, payloads, planner, SEPA) wordt niet aangeraakt. Alleen interne mail naar
// ontvangers van meldingssoort "exact_boeking"; nooit naar klanten. Gooit nooit.
// deno-lint-ignore-file no-explicit-any
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verstuurInterneMelding } from "./interneMelding.ts";
import { sanitizeError } from "./exactAlarm.ts";

export const EXACT_BOEKING_SOORT = "exact_boeking";
export const ADMINISTRATIE = "4401707";
const SITE = "https://zpzaken.nl";

export type ExactSchrijfactie = {
  methode: string; pad: string; soort: string; status: number; ok: boolean; tijd: string;
  verzoek: any; antwoord: any; fout?: string;
};

type Ctx = { bron: string; verzamel: boolean; req: Request; acties: ExactSchrijfactie[] };
const opslag = new AsyncLocalStorage<Ctx>();
let gepatcht = false;

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const guid = (s: unknown) => { const m = String(s ?? "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); return m ? m[0].toLowerCase() : null; };
export const euro = (n: number | null | undefined) => n == null || !isFinite(n) ? "onbekend" : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
const nlTijd = (iso: string) => new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
function exactDatum(v: unknown): string | null {
  if (!v) return null;
  const m = String(v).match(/\/Date\((-?\d+)\)\//);
  const d = m ? new Date(Number(m[1])) : new Date(String(v));
  return isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam" }).format(d);
}

/** Soort schrijfactie op basis van endpoint, methode en payload. */
export function soortVan(methode: string, pad: string, verzoek: any): string {
  const p = pad.toLowerCase();
  const nieuw = methode === "POST";
  if (p.includes("salesinvoice/salesinvoices")) {
    const regels: any[] = verzoek?.SalesInvoiceLines ?? [];
    const som = regels.reduce((s, r) => s + Number(r?.AmountFC ?? (Number(r?.NetPrice ?? r?.UnitPrice ?? 0) * Number(r?.Quantity ?? 1))), 0);
    const credit = Number(verzoek?.Type) === 8021 || (regels.length > 0 && som < 0);
    return credit ? (nieuw ? "Creditnota (concept) aangemaakt" : "Creditnota gewijzigd") : (nieuw ? "Verkoopfactuur (concept) aangemaakt" : "Verkoopfactuur gewijzigd");
  }
  if (p.includes("salesinvoice/salesinvoicelines")) return nieuw ? "Factuurregel toegevoegd" : "Factuurregel gewijzigd";
  if (p.includes("crm/accounts")) return nieuw ? "Relatie aangemaakt" : "Relatie gewijzigd";
  if (p.includes("crm/contacts")) return nieuw ? "Contactpersoon aangemaakt" : "Contactpersoon gewijzigd";
  if (p.includes("subscription/subscriptionlines")) return nieuw ? "Abonnementsregel aangemaakt" : "Abonnementsregel gewijzigd";
  if (p.includes("subscription/subscriptions")) return nieuw ? "Abonnement aangemaakt" : "Abonnement gewijzigd";
  if (p.includes("directdebitmandates")) return nieuw ? "Incassomachtiging aangemaakt" : "Incassomachtiging gewijzigd";
  if (p.includes("logistics/items") || p.includes("itemgroups")) return nieuw ? "Artikel(groep) aangemaakt" : "Artikel(groep) gewijzigd";
  return `${methode === "DELETE" ? "Verwijderactie" : nieuw ? "Aanmaakactie" : "Wijziging"} (${pad.split("?")[0]})`;
}

/** Foutmelding van Exact in gewone taal. */
export function foutInGewoneTaal(status: number, tekst: string): string {
  let msg = "";
  try { const j = JSON.parse(tekst); msg = j?.error?.message?.value ?? j?.error?.message ?? ""; } catch { msg = tekst; }
  msg = sanitizeError(String(msg).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 300);
  const uitleg = status === 0 ? "Exact Online was niet bereikbaar (netwerkfout)."
    : status === 401 ? "Exact weigerde de toegang: de koppeling is verlopen of ongeldig."
    : status === 403 ? "Exact gaf geen toestemming voor deze actie in administratie 4401707."
    : status === 404 ? "Exact kon het gevraagde record niet vinden."
    : status === 429 ? "Exact had te veel verzoeken tegelijk ontvangen (limiet bereikt)."
    : status >= 500 ? "Exact Online had een storing aan hun kant."
    : "Exact heeft de gegevens geweigerd.";
  return msg ? `${uitleg} Melding van Exact: ${msg}` : uitleg;
}

function installeer() {
  if (gepatcht) return;
  gepatcht = true;
  const origineel = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const ctx = opslag.getStore();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
    const methode = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const isExact = /exactonline\.[a-z.]+\/api\/v1\//i.test(url);
    if (!ctx || !isExact || !["POST", "PUT", "PATCH", "DELETE"].includes(methode)) return origineel(input, init);
    const pad = url.replace(/^.*\/api\/v1\/\d+\//i, "");
    let verzoek: any = null;
    try { verzoek = typeof init?.body === "string" ? JSON.parse(init.body) : null; } catch { verzoek = null; }
    const tijd = new Date().toISOString();
    try {
      const res = await origineel(input, init);
      let antwoord: any = null; let tekst = "";
      try { tekst = await res.clone().text(); antwoord = JSON.parse(tekst)?.d ?? null; } catch { antwoord = null; }
      ctx.acties.push({ methode, pad, soort: soortVan(methode, pad, verzoek), status: res.status, ok: res.ok, tijd, verzoek, antwoord, fout: res.ok ? undefined : foutInGewoneTaal(res.status, tekst) });
      return res;
    } catch (e) {
      ctx.acties.push({ methode, pad, soort: soortVan(methode, pad, verzoek), status: 0, ok: false, tijd, verzoek, antwoord: null, fout: foutInGewoneTaal(0, String((e as Error)?.message ?? e)) });
      throw e;
    }
  };
}

/** Verwijdert tijdelijke fouten (401/429/5xx) die binnen dezelfde aanroep met succes zijn herhaald. */
export function filterHerhaald(acties: ExactSchrijfactie[]): ExactSchrijfactie[] {
  return acties.filter((a, i) => a.ok || !(a.status === 401 || a.status === 429 || a.status >= 500 || a.status === 0)
    || !acties.slice(i + 1).some((b) => b.ok && b.methode === a.methode && b.pad.split("?")[0] === a.pad.split("?")[0]));
}

export type Regel = {
  soort: string; ok: boolean; fout?: string; tijd: string; klantnaam: string; bedrijfsnaam: string; relatiecode: string;
  documentId: string | null; inclBtw: number | null; exclBtw: number | null; periode: string; omschrijving: string;
  klantkaart: string | null; isConcept: boolean;
  /** Alleen bij opzeg-creditnota (sleutel ZPC-...): toelichting Ellen en wie goedkeurde. */
  creditToelichting?: string | null; creditGoedgekeurdDoor?: string | null;
};

async function verrijk(admin: any, a: ExactSchrijfactie): Promise<Regel> {
  const v = a.verzoek ?? {}; const r = a.antwoord ?? {};
  const accountId = guid(v.OrderedBy ?? v.InvoiceTo ?? v.Account ?? v.OrderedByAccount ?? r.OrderedBy ?? r.Account ?? (a.pad.toLowerCase().includes("crm/accounts") ? (r.ID ?? a.pad) : null));
  let lead: any = null; let ond: any = null;
  if (accountId) {
    const [l, o] = await Promise.all([
      admin.from("leads").select("id,voornaam,achternaam,bedrijfsnaam").eq("exact_account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("ondernemingen").select("id,naam,exact_relatie_code").eq("exact_account_id", accountId).limit(1).maybeSingle(),
    ]);
    lead = l.data; ond = o.data;
  }
  const regels: any[] = v.SalesInvoiceLines ?? [];
  const somRegels = regels.length ? Math.round(regels.reduce((s, x) => s + Number(x?.AmountFC ?? (Number(x?.NetPrice ?? x?.UnitPrice ?? 0) * Number(x?.Quantity ?? 1))), 0) * 100) / 100 : null;
  const num = (x: unknown) => x == null || x === "" || isNaN(Number(x)) ? null : Number(x);
  const incl = num(r.AmountDC) ?? num(r.AmountFC) ?? somRegels;
  const btw = num(r.VATAmountDC) ?? num(r.VATAmountFC);
  const excl = num(r.AmountFCExclVat) ?? (incl != null && btw != null ? Math.round((incl - btw) * 100) / 100 : somRegels);
  const starts = regels.map((x) => exactDatum(x?.StartTime)).filter(Boolean);
  const eindes = regels.map((x) => exactDatum(x?.EndTime)).filter(Boolean);
  const periode = starts.length ? `${starts[0]} t/m ${eindes[eindes.length - 1] ?? "?"}` : (exactDatum(v.StartDate) ? `vanaf ${exactDatum(v.StartDate)}${exactDatum(v.EndDate) ? ` t/m ${exactDatum(v.EndDate)}` : ""}` : "niet van toepassing");
  let creditToelichting: string | null = null; let creditGoedgekeurdDoor: string | null = null;
  const sleutel = String(v.YourRef ?? "").match(/ZPC-[0-9A-F]{8}/)?.[0] ?? String(v.Remarks ?? "").match(/ZPC-[0-9A-F]{8}/)?.[0] ?? null;
  if (sleutel) {
    const { data: c } = await admin.from("factuur_credit_planning").select("id,klant_contract_id,aanvraag_id,opzeg_toelichting,beoordeeld_door_naam").eq("creditsleutel", sleutel).maybeSingle();
    if (c) {
      creditGoedgekeurdDoor = c.beoordeeld_door_naam ?? null;
      creditToelichting = c.opzeg_toelichting ?? null;
      if (!creditGoedgekeurdDoor || !creditToelichting) {
        const { data: logs } = await admin.from("sensitive_audit_log").select("actie,details").eq("target_id", c.klant_contract_id).order("created_at", { ascending: false }).limit(50);
        for (const l of logs ?? []) {
          if (!creditGoedgekeurdDoor && l.actie === "creditnota_goedgekeurd" && l.details?.credit_id === c.id) creditGoedgekeurdDoor = l.details?.door_naam ?? null;
          if (!creditToelichting && typeof l.details?.toelichting === "string") creditToelichting = l.details.toelichting;
        }
      }
    }
  }
  const documentId = guid(r.InvoiceID ?? r.EntryID ?? r.EntryId ?? r.ID ?? r.Id) ?? guid(a.pad);
  return {
    soort: a.soort, ok: a.ok, fout: a.fout, tijd: a.tijd,
    klantnaam: lead ? `${lead.voornaam ?? ""} ${lead.achternaam ?? ""}`.trim() || "onbekend" : (v.Name ?? r.Name ?? "onbekend"),
    bedrijfsnaam: ond?.naam ?? lead?.bedrijfsnaam ?? v.Name ?? r.Name ?? r.OrderedByName ?? "onbekend",
    relatiecode: String(ond?.exact_relatie_code ?? r.Code ?? v.Code ?? r.OrderedByCode ?? "onbekend").trim(),
    documentId, inclBtw: incl, exclBtw: excl, periode,
    omschrijving: String(v.Description ?? r.Description ?? regels[0]?.Description ?? v.YourRef ?? "").slice(0, 200) || "geen omschrijving",
    klantkaart: ond ? `${SITE}/admin/klanten/${ond.id}` : lead ? `${SITE}/admin/leads/${lead.id}` : null,
    isConcept: a.pad.toLowerCase().includes("salesinvoice/salesinvoices") && a.methode === "POST",
    creditToelichting, creditGoedgekeurdDoor,
  };
}

const INSTRUCTIE_CONCEPT = "Controleer en verwerk dit in Exact via Verkoop &gt; Facturen &gt; Verwerken.";
const INSTRUCTIE_OVERIG = "Controleer deze wijziging in Exact.";

export function mailEnkel(r: Regel, door: string, test = false) {
  const kop = r.ok ? `Exact-boeking: ${r.soort}` : `MISLUKT Exact-boeking: ${r.soort}`;
  const subject = `${test ? "TEST melding Exact-boeking" : kop} – ${r.bedrijfsnaam}`;
  const rij = (k: string, w: string) => `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${k}</td><td style="padding:4px 0">${w}</td></tr>`;
  const html = `${test ? `<p style="padding:8px;border:2px solid #E53E2F;font-weight:bold">TEST: dit is een voorbeeldmelding op basis van een bestaande factuur. Er is niets naar Exact geschreven en je hoeft niets te doen.</p>` : ""}
<p>${r.ok ? "Het platform heeft zojuist iets in Exact Online ingeschoten." : "Het platform heeft geprobeerd iets in Exact Online in te schieten, maar dat is <strong>mislukt</strong>."}</p>
<table style="border-collapse:collapse;font-size:14px">
${rij("Soort", esc(r.soort))}
${rij("Klant", esc(r.klantnaam))}
${rij("Bedrijf", esc(r.bedrijfsnaam))}
${rij("Exact-relatiecode", esc(r.relatiecode))}
${rij("Factuur-/document-ID", esc(r.documentId ?? "nog niet bekend"))}
${rij("Bedrag incl. btw", esc(euro(r.inclBtw)))}
${rij("Bedrag excl. btw", esc(euro(r.exclBtw)))}
${rij("Periode", esc(r.periode))}
${rij("Omschrijving", esc(r.omschrijving))}
${rij("Administratie", ADMINISTRATIE)}
${rij("Gedaan door", esc(door))}
${rij("Tijdstip", esc(nlTijd(r.tijd)))}
${r.ok ? "" : rij("Foutmelding", `<strong>${esc(r.fout ?? "onbekend")}</strong>`)}
</table>
<p><strong>Wat te doen:</strong> ${r.ok ? (r.isConcept ? INSTRUCTIE_CONCEPT : INSTRUCTIE_OVERIG) : "Er staat niets nieuws in Exact. Laat het team weten dat deze actie opnieuw moet."}</p>
${r.klantkaart ? `<p><a href="${esc(r.klantkaart)}">Open de klantkaart in het beheer</a></p>` : ""}
<p style="color:#777;font-size:12px">Interne controlemelding van het ZP Zaken-platform. Niet doorsturen naar klanten.</p>`;
  return { subject, html };
}

export function mailVerzamel(regels: Regel[], door: string) {
  const ok = regels.filter((r) => r.ok); const mis = regels.filter((r) => !r.ok);
  const som = (a: Regel[], k: "inclBtw" | "exclBtw") => Math.round(a.reduce((s, r) => s + (r[k] ?? 0), 0) * 100) / 100;
  const subject = `Exact-boekingen factuurplanner: ${ok.length} ingeschoten${mis.length ? `, ${mis.length} MISLUKT` : ""}`;
  const td = (s: string, r = false) => `<td style="padding:4px 8px;border-bottom:1px solid #eee;${r ? "text-align:right" : ""}">${s}</td>`;
  const rijen = regels.map((r) => `<tr>${td(r.ok ? "Ingeschoten" : "<strong>Mislukt</strong>")}${td(esc(r.soort))}${td(esc(r.bedrijfsnaam) + "<br><span style=\"color:#777\">" + esc(r.klantnaam) + "</span>")}${td(esc(r.relatiecode))}${td(esc(r.documentId ?? "-"))}${td(esc(r.periode))}${td(esc(euro(r.exclBtw)), true)}${td(esc(euro(r.inclBtw)), true)}${td(r.klantkaart ? `<a href="${esc(r.klantkaart)}">klantkaart</a>` : "-")}${td(r.creditToelichting || r.creditGoedgekeurdDoor ? `${esc(r.creditToelichting ?? "geen toelichting")}<br><span style="color:#777">Goedgekeurd door ${esc(r.creditGoedgekeurdDoor ?? "onbekend")}</span>` : "-")}</tr>${r.ok ? "" : `<tr><td colspan="10" style="padding:4px 8px;color:#b00">${esc(r.fout ?? "")}</td></tr>`}`).join("");
  const html = `<p>De factuurplanner heeft in deze run de volgende acties in Exact Online (administratie ${ADMINISTRATIE}) uitgevoerd. Gedaan door: ${esc(door)}.</p>
<table style="border-collapse:collapse;font-size:13px"><thead><tr>${["Status", "Soort", "Klant", "Relatiecode", "ID", "Periode", "Excl. btw", "Incl. btw", "", "Creditnota: toelichting / akkoord"].map((h) => `<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc">${h}</th>`).join("")}</tr></thead><tbody>${rijen}</tbody>
<tfoot><tr><td colspan="6" style="padding:6px 8px"><strong>Totaal ingeschoten (${ok.length})</strong></td><td style="padding:6px 8px;text-align:right"><strong>${euro(som(ok, "exclBtw"))}</strong></td><td style="padding:6px 8px;text-align:right"><strong>${euro(som(ok, "inclBtw"))}</strong></td><td></td><td></td></tr></tfoot></table>
<p><strong>Wat te doen:</strong> ${INSTRUCTIE_CONCEPT}${mis.length ? " De mislukte regels staan niet in Exact; laat het team weten dat deze opnieuw moeten." : ""}</p>
<p style="color:#777;font-size:12px">Interne controlemelding van het ZP Zaken-platform. Niet doorsturen naar klanten.</p>`;
  return { subject, html };
}

async function wieDoetHet(admin: any, req: Request): Promise<string> {
  if (req.headers.get("x-cron-secret")) return "Automatische planner (geplande taak)";
  const auth = req.headers.get("Authorization") ?? "";
  try {
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token.split(".").length === 3) {
      const { data } = await admin.auth.getUser(token);
      const u = data?.user;
      if (u) {
        const { data: p } = await admin.from("profiles").select("full_name").eq("id", u.id).maybeSingle();
        return `Teamlid ${p?.full_name?.trim() || u.email || u.id}`;
      }
    }
  } catch { /* geen gebruiker */ }
  if (req.headers.get("x-internal-secret")) return "Automatisch systeemproces (intern)";
  return "Onbekend (systeem)";
}

async function verstuur(ctx: Ctx) {
  const acties = filterHerhaald(ctx.acties);
  if (!acties.length) return;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const door = await wieDoetHet(admin, ctx.req);
  const regels: Regel[] = [];
  for (const a of acties) regels.push(await verrijk(admin, a));
  const meta = (r: Regel[]) => ({ bron: ctx.bron, soort: EXACT_BOEKING_SOORT, administratie: ADMINISTRATIE, acties: r.map((x) => ({ soort: x.soort, ok: x.ok, id: x.documentId, incl: x.inclBtw })) });
  if (ctx.verzamel) {
    const m = mailVerzamel(regels, door);
    await verstuurInterneMelding(admin, ctx.req, `${ctx.bron}:exact-boeking`, { leadType: "exact-boeking", subject: m.subject, html: m.html, metadata: meta(regels), soort: EXACT_BOEKING_SOORT });
    return;
  }
  for (const r of regels) {
    const m = mailEnkel(r, door);
    await verstuurInterneMelding(admin, ctx.req, `${ctx.bron}:exact-boeking`, { leadType: "exact-boeking", subject: m.subject, html: m.html, metadata: meta([r]), soort: EXACT_BOEKING_SOORT });
  }
}

/** Omhult een Deno.serve-handler: alle Exact-schrijfacties in deze aanroep krijgen een interne melding. */
export function metExactMelding(bron: string, handler: (req: Request) => Response | Promise<Response>, opties: { verzamel?: boolean } = {}) {
  installeer();
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return handler(req);
    const ctx: Ctx = { bron, verzamel: !!opties.verzamel, req, acties: [] };
    const klaar = () => {
      const p = verstuur(ctx).catch((e) => console.error(`exact-boeking-melding ${bron}:`, String((e as Error)?.message ?? e)));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(p); else return p;
    };
    try {
      const res = await opslag.run(ctx, () => handler(req));
      await klaar();
      return res;
    } catch (e) {
      await klaar();
      throw e;
    }
  };
}

export { verrijk as _verrijkVoorTest };
