// deno-lint-ignore-file no-explicit-any
// KVK API, alleen Basisprofiel. Sleutel: secret KVK_API_KEY. Kostenbewaking: zie haalKvkProfiel (A12).
// Cache 30 dagen in kvk_profielen; elke opvraging in kvk_opvraag_log. Afgeschermde adressen worden nooit teruggegeven.
async function sha256Hex(t: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const KVK_CACHE_DAGEN = 30;
const BASIS = "https://api.kvk.nl/api/v1";

export type KvkAdres = { straat: string | null; huisnummer: string | null; postcode: string | null; plaats: string | null; postbus: string | null };
export type KvkProfiel = {
  kvk_nummer: string;
  naam: string | null;           // statutaire naam, anders eerste handelsnaam
  statutaire_naam: string | null;
  handelsnamen: string[];
  rechtsvorm: string | null;
  datum_inschrijving: string | null; // yyyy-mm-dd
  datum_aanvang: string | null;
  bezoekadres: KvkAdres | null;      // null als afgeschermd of onbekend
  postadres: KvkAdres | null;
  adres_afgeschermd: boolean;
  sbi: { code: string; omschrijving: string; hoofd: boolean }[];
  vestigingsnummer: string | null;
};
export type KvkResultaat =
  | { ok: true; profiel: KvkProfiel; uit_cache: boolean }
  | { ok: false; reden: "geen_sleutel" | "niet_gevonden" | "ongeldig" | "fout" | "rate_limit" | "uitgeschakeld" | "limiet"; melding: string };

export const KVK_NIET_BESCHIKBAAR = "KVK-controle niet beschikbaar";

export function kvkGeldig(n: unknown): n is string { return typeof n === "string" && /^\d{8}$/.test(n); }

/** KVK-datum "20240115" naar "2024-01-15". */
export function kvkDatum(d: unknown): string | null {
  const s = String(d ?? "");
  if (!/^\d{8}$/.test(s) || s.endsWith("0000")) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Startdatum voor het startertarief (register D3): de formele registratiedatum. */
export function kvkStartdatum(p: Pick<KvkProfiel, "datum_inschrijving" | "datum_aanvang">): string | null {
  return p.datum_inschrijving ?? null;
}

function plusMnd(dag: string, n: number): string {
  const [y, m, d] = dag.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const laatste = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, laatste));
  return t.toISOString().slice(0, 10);
}
const nl = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

/** KVK-oordeel startertarief (voorstel, nooit automatisch): starter als inschrijving <= ingang < inschrijving + 12 maanden. */
export function kvkStarterOordeel(p: Pick<KvkProfiel, "datum_inschrijving" | "datum_aanvang"> | null | undefined, ingangsdatum: string | null | undefined) {
  if (!p?.datum_inschrijving || !ingangsdatum) return null;
  const ins = p.datum_inschrijving, eind = plusMnd(ins, 12);
  const voldoet = ins <= ingangsdatum && ingangsdatum < eind;
  const tekst = voldoet ? `Voldoet volgens KVK (ingeschreven ${nl(ins)})` : `Voldoet niet (ingeschreven ${nl(ins)}; startertarief vervalt per ${nl(eind)})`;
  const verschil = p.datum_aanvang ? Math.abs(Date.parse(p.datum_aanvang) - Date.parse(ins)) / 864e5 : 0;
  const aandacht = verschil > 30 ? `Datum aanvang volgens KVK (${nl(p.datum_aanvang!)}) wijkt ${Math.round(verschil)} dagen af van de inschrijving` : null;
  return { voldoet, ingeschreven: ins, vervalt_per: eind, tekst, aandacht };
}

function adres(a: any): KvkAdres {
  const nr = [a?.huisnummer, a?.huisletter, a?.huisnummerToevoeging].filter((x) => x !== undefined && x !== null && x !== "").join("");
  return {
    straat: a?.straatnaam ?? null, huisnummer: nr || null,
    postcode: a?.postcode ? String(a.postcode).replace(/\s/g, "").toUpperCase() : null,
    plaats: a?.plaats ?? null, postbus: a?.postbusnummer ? String(a.postbusnummer) : null,
  };
}
const afgeschermd = (a: any) => String(a?.indAfgeschermd ?? "").toLowerCase() === "ja";

/** Zet KVK-responses om naar ons profiel. Puur, getest. */
export function parseKvk(basis: any, vestiging: any | null): KvkProfiel {
  const hv = vestiging ?? basis?._embedded?.hoofdvestiging ?? {};
  const adressen: any[] = Array.isArray(hv?.adressen) ? hv.adressen : [];
  const bezoek = adressen.find((a) => a?.type === "bezoekadres");
  const post = adressen.find((a) => a?.type === "correspondentieadres" || a?.type === "postadres");
  const eigenaar = basis?._embedded?.eigenaar ?? {};
  const handelsnamen = (Array.isArray(basis?.handelsnamen) ? basis.handelsnamen : [])
    .slice().sort((a: any, b: any) => (a?.volgorde ?? 0) - (b?.volgorde ?? 0)).map((h: any) => String(h?.naam ?? "")).filter(Boolean);
  const sbiBron = Array.isArray(hv?.sbiActiviteiten) && hv.sbiActiviteiten.length ? hv.sbiActiviteiten : (basis?.sbiActiviteiten ?? []);
  return {
    kvk_nummer: String(basis?.kvkNummer ?? ""),
    statutaire_naam: basis?.statutaireNaam ?? null,
    naam: basis?.statutaireNaam ?? basis?.naam ?? handelsnamen[0] ?? null,
    handelsnamen,
    rechtsvorm: eigenaar?.uitgebreideRechtsvorm ?? eigenaar?.rechtsvorm ?? null,
    datum_inschrijving: kvkDatum(basis?.formeleRegistratiedatum),
    datum_aanvang: kvkDatum(basis?.materieleRegistratie?.datumAanvang),
    bezoekadres: bezoek && !afgeschermd(bezoek) ? adres(bezoek) : null,
    postadres: post && !afgeschermd(post) ? adres(post) : null,
    adres_afgeschermd: !!(bezoek && afgeschermd(bezoek)),
    sbi: (sbiBron as any[]).map((s) => ({ code: String(s?.sbiCode ?? ""), omschrijving: String(s?.sbiOmschrijving ?? ""), hoofd: String(s?.indHoofdactiviteit ?? "").toLowerCase() === "ja" })),
    vestigingsnummer: hv?.vestigingsnummer ?? null,
  };
}

export async function ipHash(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "onbekend";
  return (await sha256Hex(`kvk:${ip}`)).slice(0, 32);
}

/** Alleen de KVK-testomgeving, met de publieke testsleutel van developers.kvk.nl. Kost niets. */
export const KVK_TEST_URL = "https://api.kvk.nl/test/api/v1";
export const KVK_TEST_SLEUTEL = "l7xx1f2691f2520d487b902f4e0b57a0b197";
export const KVK_PRIJS = 0.02;

/** Precies 8 cijfers en niet 00000000. */
export function kvkBevraagbaar(n: unknown): n is string { return kvkGeldig(n) && n !== "00000000"; }

type Opties = {
  bron: string; ip_hash?: string | null; uid?: string | null; vers?: boolean;
  /** Rooktest: hard tegen de testomgeving, geen cache, geen kosten, geen schakelaar of limiet. */
  testomgeving?: boolean;
  fetchFn?: typeof fetch; sleutel?: string | null; wachtMs?: number;
};

/**
 * Eén kostenbewaakte ingang voor ELKE KVK-bevraging (besluit A12). Volgorde: formaat, cache (30 dagen),
 * uitschakelaar integratie_config 'kvk_api', sleutel, dag-/maandlimiet, claim per nummer, dan alleen Basisprofiel.
 * `admin` is een service-role client. Elke poging komt in kvk_opvraag_log met kosten_eur.
 */
export async function haalKvkProfiel(admin: any, kvk: string, opts: Opties): Promise<KvkResultaat> {
  const test = opts.testomgeving === true;
  const log = (resultaat: string, extra: Record<string, unknown> = {}) =>
    admin.from("kvk_opvraag_log").insert({ kvk_nummer: kvkGeldig(kvk) ? kvk : null, bron: test ? "rooktest" : opts.bron, resultaat, ip_hash: opts.ip_hash ?? null, uitgevoerd_door: opts.uid ?? null, uit_cache: false, kosten_eur: 0, ...extra }).then(() => null, () => null);
  if (!kvkBevraagbaar(kvk)) { await log("ongeldig"); return { ok: false, reden: "ongeldig", melding: "KVK-nummer moet 8 cijfers zijn" }; }

  const uitCache = async (): Promise<KvkProfiel | null> => {
    const { data: c } = await admin.from("kvk_profielen").select("profiel,opgehaald_op").eq("kvk_nummer", kvk).maybeSingle();
    return c && Date.now() - new Date(c.opgehaald_op).getTime() < KVK_CACHE_DAGEN * 864e5 ? c.profiel as KvkProfiel : null;
  };
  if (!test && !opts.vers) {
    const c = await uitCache();
    if (c) { await log("ok", { uit_cache: true }); return { ok: true, profiel: c, uit_cache: true }; }
  }

  let basisUrl = KVK_TEST_URL;
  let sleutel: string | null | undefined = KVK_TEST_SLEUTEL;
  if (!test) {
    const { data: sch } = await admin.from("integratie_config").select("enabled").eq("naam", "kvk_api").maybeSingle();
    if (sch?.enabled !== true) { await log("uitgeschakeld"); return { ok: false, reden: "uitgeschakeld", melding: KVK_NIET_BESCHIKBAAR }; }
    sleutel = opts.sleutel !== undefined ? opts.sleutel : (globalThis as any).Deno?.env.get("KVK_API_KEY");
    if (!sleutel) { await log("geen_sleutel"); return { ok: false, reden: "geen_sleutel", melding: KVK_NIET_BESCHIKBAAR }; }
    const { data: inst } = await admin.from("kvk_instellingen").select("dag_limiet,maand_limiet,basis_url").maybeSingle();
    const { data: teller } = await admin.rpc("kvk_betaald_teller");
    const dag = Number(teller?.dag ?? 0), maand = Number(teller?.maand ?? 0);
    if (dag >= Number(inst?.dag_limiet ?? 100) || maand >= Number(inst?.maand_limiet ?? 1000)) {
      await log("limiet", { melding: `dag ${dag}, maand ${maand}` });
      await admin.rpc("machine_log", { _station: "kwaliteit", _actie: "kvk_limiet", _tekst: "KVK-limiet bereikt, bevragingen gestopt", _status: "fout", _bron: "kvk", _is_test: false, _op: new Date().toISOString() }).then(() => null, () => null);
      return { ok: false, reden: "limiet", melding: "KVK-limiet bereikt" };
    }
    basisUrl = String(inst?.basis_url ?? "https://api.kvk.nl/api/v1").replace(/\/$/, "");
    // Dedupe: maximaal één lopende bevraging per nummer.
    const { data: claim } = await admin.rpc("kvk_claim", { _kvk: kvk });
    if (claim !== true) {
      const tot = Date.now() + (opts.wachtMs ?? 6000);
      while (Date.now() < tot) {
        await new Promise((r) => setTimeout(r, 400));
        const c = await uitCache();
        if (c) { await log("ok", { uit_cache: true, melding: "na gelijktijdige bevraging" }); return { ok: true, profiel: c, uit_cache: true }; }
      }
      await log("bezig");
      return { ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR };
    }
  }

  const f = opts.fetchFn ?? fetch;
  try {
    // Alleen Basisprofiel, zonder geodata. Geen Vestigingsprofiel of Naamgeving.
    const r = await f(`${basisUrl}/basisprofielen/${kvk}?geoData=false`, { headers: { apikey: String(sleutel), Accept: "application/json" } });
    const kosten = test ? 0 : KVK_PRIJS;
    if (r.status === 404 || r.status === 400) { await r.text().catch(() => null); await log("niet_gevonden", { http_status: r.status, kosten_eur: kosten }); return { ok: false, reden: "niet_gevonden", melding: "KVK-nummer niet gevonden in het handelsregister" }; }
    if (r.status === 429) { await r.text().catch(() => null); await log("rate_limit", { http_status: 429 }); return { ok: false, reden: "rate_limit", melding: KVK_NIET_BESCHIKBAAR }; }
    if (!r.ok) { await r.text().catch(() => null); await log("fout", { http_status: r.status }); return { ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR }; }
    const profiel = parseKvk(await r.json(), null);
    if (!test) await admin.from("kvk_profielen").upsert({ kvk_nummer: kvk, profiel, opgehaald_op: new Date().toISOString(), bron: "kvk_api" });
    await log("ok", { http_status: 200, kosten_eur: kosten });
    return { ok: true, profiel, uit_cache: false };
  } catch (e) {
    await log("fout", { melding: String((e as Error)?.message ?? e).slice(0, 200) });
    return { ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR };
  } finally {
    if (!test) await admin.rpc("kvk_claim_vrijgeven", { _kvk: kvk }).then(() => null, () => null);
  }
}

/** Kolommen voor ondernemingen.kvk_* (eigen naam/adres blijven ongemoeid). */
export function kvkKolommen(p: KvkProfiel) {
  return {
    kvk_naam: p.naam, kvk_handelsnamen: p.handelsnamen, kvk_rechtsvorm: p.rechtsvorm,
    kvk_straat: p.bezoekadres?.straat ?? null, kvk_huisnummer: p.bezoekadres?.huisnummer ?? null,
    kvk_postcode: p.bezoekadres?.postcode ?? null, kvk_plaats: p.bezoekadres?.plaats ?? null,
    kvk_postadres: p.postadres, kvk_adres_afgeschermd: p.adres_afgeschermd,
    kvk_datum_inschrijving: p.datum_inschrijving, kvk_datum_aanvang: p.datum_aanvang, kvk_sbi: p.sbi,
    kvk_opgehaald_op: new Date().toISOString(), kvk_bron: "kvk_api", kvk_status: "ok",
  };
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Verschillen tussen klantopgave en KVK (KVK wint). Adresvelden alleen vergelijken als het KVK-adres zichtbaar is. */
export function kvkAfwijkingen(klant: Record<string, unknown>, kvk: Record<string, unknown>, metAdres: boolean): { veld: string; klant: unknown; kvk: unknown }[] {
  const velden = ["bedrijfsnaam", "kvk_startdatum", ...(metAdres ? ["straat", "huisnummer", "postcode", "plaats"] : [])];
  return velden.filter((v) => kvk[v] && klant[v] && norm(klant[v]) !== norm(kvk[v])).map((v) => ({ veld: v, klant: klant[v], kvk: kvk[v] }));
}

/**
 * Besluit Boy 13 okt 2026: startertarief automatisch goedgekeurd als de startdatum uit de KVK API komt,
 * de regel klopt en datum aanvang niet meer dan 30 dagen afwijkt. Anders 'te_controleren' (Ellen beslist).
 */
export function starterBesluitKvk(
  profiel: Pick<KvkProfiel, "datum_inschrijving" | "datum_aanvang"> | null | undefined,
  ingangsdatum: string | null | undefined,
  bron: string | null | undefined,
): { status: "goedgekeurd" | "te_controleren"; toelichting: string | null } {
  const o = bron === "kvk_api" ? kvkStarterOordeel(profiel, ingangsdatum) : null;
  if (o && o.voldoet && !o.aandacht) {
    return { status: "goedgekeurd", toelichting: `Automatisch goedgekeurd op KVK-gegevens (ingeschreven ${nl(o.ingeschreven)})` };
  }
  return { status: "te_controleren", toelichting: o ? (o.aandacht ?? o.tekst) : null };
}
