// Herkomst van een bezoeker (alleen first-party). Wordt meegestuurd met publieke
// formulieren → leads.extra_data.attributie en aanvraag_concepten.attributie.
//
// - utm_*, referrer, landingspagina: sessionStorage, eerste bezoek in de sessie (geen toestemming nodig),
//   plus 90 dagen in localStorage (zp_attributie_90d); de laatste betaalde klik (utm of klik-ID) gaat voor.
// - Klik-ID's (gclid, gbraid, wbraid, msclkid, oppref): alleen na toestemming marketing-cookies,
//   in localStorage met een bewaartermijn van 90 dagen. Zonder toestemming blijven ze
//   alleen in het geheugen van de huidige pagina en worden ze nooit opgeslagen of verstuurd.
//   Intrekken van toestemming wist ze direct.
import {
  ATTRIBUTIE_SLEUTELS, KLIK_ID_SLEUTELS, KLIK_ID_PATROON, bepaalKanaal, schoneUrl,
  type Attributie, type KlikIdSleutel,
} from "../../supabase/functions/_shared/attributie";

const KEY = "zp_attributie";
const KLIK_KEY = "zp_klikids";
const CONSENT_KEY = "zpzaken_cookie_consent";
const CONSENT_VERSIE = "1.0";
export const KLIK_ID_BEWAARDAGEN = 90;

type KlikIds = Partial<Record<KlikIdSleutel, string>>;
let wachtendeKlikIds: KlikIds | null = null;

/** Actuele toestemming voor marketing-cookies (zelfde opslag als de cookiebanner). */
export function heeftMarketingToestemming(): boolean {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (!v) return false;
    const p = JSON.parse(v) as { marketing?: boolean; version?: string };
    return p.version === CONSENT_VERSIE && p.marketing === true;
  } catch {
    return false;
  }
}

function klikIdsUitUrl(): KlikIds | null {
  const q = new URLSearchParams(window.location.search);
  const uit: KlikIds = {};
  for (const k of KLIK_ID_SLEUTELS) {
    const v = q.get(k);
    if (v && KLIK_ID_PATROON.test(v)) uit[k] = v;
  }
  return Object.keys(uit).length ? uit : null;
}

function bewaarKlikIds(ids: KlikIds) {
  localStorage.setItem(KLIK_KEY, JSON.stringify({ ...ids, opgeslagen_op: new Date().toISOString() }));
}

function leesKlikIds(): KlikIds | null {
  try {
    const v = localStorage.getItem(KLIK_KEY);
    if (!v) return null;
    const p = JSON.parse(v) as KlikIds & { opgeslagen_op?: string };
    const t = Date.parse(p.opgeslagen_op ?? "");
    if (!t || Date.now() - t > KLIK_ID_BEWAARDAGEN * 86_400_000) {
      localStorage.removeItem(KLIK_KEY);
      return null;
    }
    const uit: KlikIds = {};
    for (const k of KLIK_ID_SLEUTELS) if (typeof p[k] === "string") uit[k] = p[k];
    return Object.keys(uit).length ? uit : null;
  } catch {
    return null;
  }
}

/** Na een cookiekeuze: wachtende klik-ID's opslaan, of alles wissen bij geen toestemming. */
function verwerkCookieKeuze() {
  try {
    if (heeftMarketingToestemming()) {
      if (wachtendeKlikIds) { bewaarKlikIds(wachtendeKlikIds); wachtendeKlikIds = null; }
    } else {
      localStorage.removeItem(KLIK_KEY);
    }
  } catch { /* geen opslag */ }
}

let luisteraar = false;

/** 90-dagenrecord (zonder klik-ID's), naast de sessie. */
export const LANG_KEY = "zp_attributie_90d";
export const ATTRIBUTIE_BEWAARDAGEN = 90;
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function advertentieklikVoor(klik: KlikIds): string {
  if (klik.oppref && !klik.gclid && !klik.gbraid && !klik.wbraid && !klik.msclkid) return "openai";
  return klik.msclkid && !klik.gclid && !klik.gbraid && !klik.wbraid ? "microsoft" : "google";
}

/** Herkomst van deze binnenkomst (zonder klik-ID's). */
function binnenkomst(klik: KlikIds | null): Record<string, string> {
  const q = new URLSearchParams(window.location.search);
  const a: Record<string, string> = {};
  for (const k of ATTRIBUTIE_SLEUTELS) {
    if ((KLIK_ID_SLEUTELS as readonly string[]).includes(k)) continue; // nooit in opslag zonder toestemming
    const v = q.get(k);
    if (v) a[k] = v.slice(0, 200);
  }
  if (klik) a.advertentieklik = advertentieklikVoor(klik);
  const ref = document.referrer ? schoneUrl(document.referrer) : "";
  if (ref && new URL(ref).host !== window.location.host) a.referrer = ref;
  a.landingspagina = window.location.pathname;
  a.eerste_bezoek_op = new Date().toISOString();
  return a;
}

function leesLangRecord(): Record<string, string> | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (!v) return null;
    const p = JSON.parse(v) as Record<string, string>;
    const t = Date.parse(p.opgeslagen_op ?? "");
    if (!t || Date.now() - t > ATTRIBUTIE_BEWAARDAGEN * 86_400_000) {
      localStorage.removeItem(LANG_KEY);
      return null;
    }
    const uit: Record<string, string> = {};
    for (const k of ATTRIBUTIE_SLEUTELS) {
      if ((KLIK_ID_SLEUTELS as readonly string[]).includes(k)) continue;
      if (typeof p[k] === "string") uit[k] = p[k];
    }
    return Object.keys(uit).length ? uit : null;
  } catch {
    return null;
  }
}

/** Laatste betaalde klik gaat voor: utm of klik-ID overschrijft; direct/organisch nooit een bestaand record. */
function werkLangRecordBij(a: Record<string, string>, betaald: boolean) {
  try {
    if (!betaald && leesLangRecord()) return;
    localStorage.setItem(LANG_KEY, JSON.stringify({ ...a, opgeslagen_op: new Date().toISOString() }));
  } catch { /* geen opslag */ }
}

export function legAttributieVast(): void {
  if (typeof window === "undefined") return;
  try {
    // Klik-ID's bij elke binnenkomst controleren (een nieuwe advertentieklik vervangt de oude).
    const klik = klikIdsUitUrl();
    if (klik) {
      if (heeftMarketingToestemming()) bewaarKlikIds(klik);
      else wachtendeKlikIds = klik;
    }
    if (!luisteraar) {
      luisteraar = true;
      window.addEventListener("zp-cookie-keuze", verwerkCookieKeuze);
      // Andere tabbladen: keuze direct volgen.
      window.addEventListener("storage", (e) => { if (e.key === CONSENT_KEY) verwerkCookieKeuze(); });
    }

    const nu = binnenkomst(klik);
    const betaald = !!klik || UTM.some((k) => !!nu[k]);
    const bestaand = sessionStorage.getItem(KEY);
    if (bestaand) {
      // Latere advertentieklik in dezelfde sessie: alleen de kanaalmarkering bijwerken.
      if (klik) {
        const p = JSON.parse(bestaand) as Record<string, string>;
        p.advertentieklik = advertentieklikVoor(klik);
        sessionStorage.setItem(KEY, JSON.stringify(p));
      }
      if (betaald) werkLangRecordBij(nu, true);
      return;
    }
    sessionStorage.setItem(KEY, JSON.stringify(nu));
    werkLangRecordBij(nu, betaald);
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function leesAttributie(): Attributie | null {
  if (typeof window === "undefined") return null;
  const marketing = heeftMarketingToestemming();
  try {
    const v = sessionStorage.getItem(KEY);
    const lang = leesLangRecord();
    const basis = v ? (JSON.parse(v) as Record<string, string>) : { ...(lang ?? {}) };
    const betaald = (a: Record<string, string>) => UTM.some(k => !!a[k]) || !!a.advertentieklik;
    const extern = (ref: string | undefined) => {
      try { return !!ref && new URL(ref).host !== window.location.host; } catch { return false; }
    };
    // Een directe terugkeer behoudt de laatste betaalde herkomst, niet de oude landingspagina.
    if (lang && betaald(lang) && (!v || (!betaald(basis) && !extern(basis.referrer)))) {
      for (const k of [...UTM, "advertentieklik"] as const) {
        delete basis[k];
        if (lang[k]) basis[k] = lang[k];
      }
      basis.herkomst_uit = "90d";
    }
    // Oude sessies kunnen nog klik-ID's bevatten: altijd weglaten, alleen de toegestane bron gebruiken.
    for (const k of KLIK_ID_SLEUTELS) delete basis[k];
    delete basis.kanaal;
    const klik = marketing ? leesKlikIds() : null;
    const a = { ...basis, ...(klik ?? {}) };
    return { ...a, marketing_toestemming: marketing, kanaal: bepaalKanaal(a) } as Attributie;
  } catch {
    return { marketing_toestemming: marketing, kanaal: "direct" };
  }
}
