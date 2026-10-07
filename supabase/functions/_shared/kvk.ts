// deno-lint-ignore-file no-explicit-any
// KVK API (Basisprofiel + Vestigingsprofiel hoofdvestiging). Sleutel: secret KVK_API_KEY.
// Cache 30 dagen in kvk_profielen; elke opvraging in kvk_opvraag_log. Afgeschermde adressen worden nooit teruggegeven.
import { sha256Hex } from "./sepaBewijs.ts";

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
  | { ok: false; reden: "geen_sleutel" | "niet_gevonden" | "ongeldig" | "fout" | "rate_limit"; melding: string };

export const KVK_NIET_BESCHIKBAAR = "KVK-controle niet beschikbaar";

export function kvkGeldig(n: unknown): n is string { return typeof n === "string" && /^\d{8}$/.test(n); }

/** KVK-datum "20240115" naar "2024-01-15". */
export function kvkDatum(d: unknown): string | null {
  const s = String(d ?? "");
  if (!/^\d{8}$/.test(s) || s.endsWith("0000")) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Vroegste van inschrijving en aanvang: geldt voor het startertarief. */
export function kvkStartdatum(p: Pick<KvkProfiel, "datum_inschrijving" | "datum_aanvang">): string | null {
  const d = [p.datum_inschrijving, p.datum_aanvang].filter(Boolean).sort() as string[];
  return d[0] ?? null;
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

/** Haalt een profiel op (cache eerst). `admin` is een service-role client. */
export async function haalKvkProfiel(admin: any, kvk: string, opts: { bron: string; ip_hash?: string | null; uid?: string | null; vers?: boolean; limietPerUur?: number }): Promise<KvkResultaat> {
  const log = (resultaat: string, extra: Record<string, unknown> = {}) =>
    admin.from("kvk_opvraag_log").insert({ kvk_nummer: kvkGeldig(kvk) ? kvk : null, bron: opts.bron, resultaat, ip_hash: opts.ip_hash ?? null, uitgevoerd_door: opts.uid ?? null, ...extra }).then(() => null, () => null);
  if (!kvkGeldig(kvk)) { await log("ongeldig"); return { ok: false, reden: "ongeldig", melding: "KVK-nummer moet 8 cijfers zijn" }; }

  if (!opts.vers) {
    const { data: c } = await admin.from("kvk_profielen").select("profiel,opgehaald_op").eq("kvk_nummer", kvk).maybeSingle();
    if (c && Date.now() - new Date(c.opgehaald_op).getTime() < KVK_CACHE_DAGEN * 864e5) {
      await log("ok", { uit_cache: true });
      return { ok: true, profiel: c.profiel as KvkProfiel, uit_cache: true };
    }
  }
  if (opts.limietPerUur && opts.ip_hash) {
    const { count } = await admin.from("kvk_opvraag_log").select("id", { count: "exact", head: true })
      .eq("ip_hash", opts.ip_hash).eq("uit_cache", false).gte("created_at", new Date(Date.now() - 36e5).toISOString());
    if ((count ?? 0) >= opts.limietPerUur) { await log("rate_limit"); return { ok: false, reden: "rate_limit", melding: "Te veel KVK-opvragingen, probeer het later opnieuw" }; }
  }
  const sleutel = Deno.env.get("KVK_API_KEY");
  if (!sleutel) { await log("geen_sleutel"); return { ok: false, reden: "geen_sleutel", melding: KVK_NIET_BESCHIKBAAR }; }

  try {
    const r = await fetch(`${BASIS}/basisprofielen/${kvk}?geoData=false`, { headers: { apikey: sleutel, Accept: "application/json" } });
    if (r.status === 404 || r.status === 400) { await log("niet_gevonden", { http_status: r.status }); return { ok: false, reden: "niet_gevonden", melding: "KVK-nummer niet gevonden in het handelsregister" }; }
    if (!r.ok) { await log("fout", { http_status: r.status }); return { ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR }; }
    const basis = await r.json();
    let vest: any = null;
    const vnr = basis?._embedded?.hoofdvestiging?.vestigingsnummer;
    if (vnr) {
      const v = await fetch(`${BASIS}/vestigingsprofielen/${vnr}?geoData=false`, { headers: { apikey: sleutel, Accept: "application/json" } });
      if (v.ok) vest = await v.json();
    }
    const profiel = parseKvk(basis, vest);
    await admin.from("kvk_profielen").upsert({ kvk_nummer: kvk, profiel, opgehaald_op: new Date().toISOString(), bron: "kvk_api" });
    await log("ok", { http_status: 200 });
    return { ok: true, profiel, uit_cache: false };
  } catch (e) {
    await log("fout", { melding: String((e as Error)?.message ?? e).slice(0, 200) });
    return { ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR };
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
