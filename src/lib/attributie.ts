// Herkomst van een bezoeker (alleen first-party). Wordt meegestuurd met publieke
// formulieren → leads.extra_data.attributie en aanvraag_concepten.attributie.
//
// - utm_*, referrer, landingspagina: sessionStorage, eerste bezoek in de sessie (geen toestemming nodig).
// - Klik-ID's (gclid, gbraid, wbraid, msclkid): alleen na toestemming marketing-cookies,
//   in localStorage met een bewaartermijn van 90 dagen. Zonder toestemming blijven ze
//   alleen in het geheugen van de huidige pagina en worden ze nooit opgeslagen of verstuurd.
//   Intrekken van toestemming wist ze direct.
import {
  ATTRIBUTIE_SLEUTELS, KLIK_ID_SLEUTELS, bepaalKanaal, schoneUrl,
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
    if (v && /^[\w-]{1,200}$/.test(v)) uit[k] = v;
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

    const bestaand = sessionStorage.getItem(KEY);
    if (bestaand) {
      // Latere advertentieklik in dezelfde sessie: alleen de kanaalmarkering bijwerken.
      if (klik) {
        const p = JSON.parse(bestaand) as Record<string, string>;
        p.advertentieklik = klik.msclkid && !klik.gclid && !klik.gbraid && !klik.wbraid ? "microsoft" : "google";
        sessionStorage.setItem(KEY, JSON.stringify(p));
      }
      return;
    }
    const q = new URLSearchParams(window.location.search);
    const a: Record<string, string> = {};
    for (const k of ATTRIBUTIE_SLEUTELS) {
      if ((KLIK_ID_SLEUTELS as readonly string[]).includes(k)) continue; // nooit in sessionStorage
      const v = q.get(k);
      if (v) a[k] = v.slice(0, 200);
    }
    if (klik) a.advertentieklik = klik.msclkid && !klik.gclid && !klik.gbraid && !klik.wbraid ? "microsoft" : "google";
    const ref = document.referrer ? schoneUrl(document.referrer) : "";
    if (ref && new URL(ref).host !== window.location.host) a.referrer = ref;
    a.landingspagina = window.location.pathname;
    a.eerste_bezoek_op = new Date().toISOString();
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function leesAttributie(): Attributie | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    const basis = v ? (JSON.parse(v) as Record<string, string>) : {};
    // Oude sessies kunnen nog klik-ID's bevatten: altijd weglaten, alleen de toegestane bron gebruiken.
    for (const k of KLIK_ID_SLEUTELS) delete basis[k];
    delete basis.kanaal;
    const klik = heeftMarketingToestemming() ? leesKlikIds() : null;
    const a = { ...basis, ...(klik ?? {}) };
    if (!Object.keys(a).length) return null;
    return { ...a, kanaal: bepaalKanaal(a) } as Attributie;
  } catch {
    return null;
  }
}
