/**
 * GA4-meting via gtag (Consent Mode v2 uit index.html bepaalt wat er mag).
 * Interne omgevingen (/admin, /portal, /mijn-zp) sturen nooit iets naar GA4.
 */
import { heeftMarketingToestemming } from "./attributie";
import { openaiLeadEventId } from "../../supabase/functions/_shared/openaiAdsEvent";
import { isNlTelefoon, normaliseerNlTelefoon } from "../../supabase/functions/_shared/telefoon";


export const GA_ID = "G-YY7YJFFEZN";
export const GOOGLE_ADS_ID = "AW-18497139684";
/** Google Ads-conversieactie (aanvraag BAV + AVB). Pas hier aan bij een nieuwe conversieactie. */
export const GOOGLE_ADS_CONVERSIE = "AW-18497139684/rIoQCIid-5IdEOTnj_RE";
/**
 * Secundaire Google Ads-conversies (terugbelverzoek en contactformulier).
 * Alleen een geldig actielabel mag een Google Ads-conversie opleveren.
 */
export const GOOGLE_ADS_CONVERSIE_TERUGBEL = "NMSZCIao65wdEOTnj_RE";
export const GOOGLE_ADS_CONVERSIE_CONTACT = "Z5lyCN2R85wdEOTnj_RE";
export function adsSendTo(label: string): string | null {
  return /^[\w-]{10,}$/.test(label) ? `${GOOGLE_ADS_ID}/${label}` : null;
}
/** Microsoft Advertising UET-tag-ID. */
export const MS_UET_ID = "187280316";

type Uetq = { push: (...a: unknown[]) => void };
const uetq = (): Uetq | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { uetq?: Uetq }).uetq);
let uetGeladen = false;
let uetGeinstalleerd = false;

function laadUet() {
  if (uetGeladen || typeof document === "undefined") return;
  uetGeladen = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://bat.bing.com/bat.js";
  s.onload = () => {
    const UET = (window as unknown as { UET?: new (o: Record<string, unknown>) => Uetq }).UET;
    if (!UET) { uetGeladen = false; s.remove(); return; }
    const wachtrij = (window as unknown as { uetq?: unknown }).uetq;
    const inst = new UET({ ti: MS_UET_ID, q: wachtrij });
    (window as unknown as { uetq: Uetq }).uetq = inst;
    inst.push("pageLoad");
  };
  s.onerror = () => { uetGeladen = false; s.remove(); };
  document.head.appendChild(s);
}

function verwerkUetToestemming() {
  const ja = heeftMarketingToestemming();
  uetq()?.push("consent", "update", { ad_storage: ja ? "granted" : "denied" });
  if (ja && !isNietGemetenPad(window.location.pathname)) laadUet();
}

/**
 * UET (bat.js) wordt pas geladen na toestemming voor marketingcookies en nooit op interne paden.
 * Consent Mode: standaard ad_storage denied, update bij elke cookiekeuze.
 */
export function installeerUet(pathname: string) {
  if (!MS_UET_ID || uetGeinstalleerd || typeof window === "undefined") return;
  uetGeinstalleerd = true;
  const w = window as unknown as { uetq?: unknown[] };
  w.uetq = w.uetq || [];
  (w.uetq as unknown[]).push("consent", "default", { ad_storage: "denied" });
  window.addEventListener("zp-cookie-keuze", verwerkUetToestemming);
  window.addEventListener("storage", (e) => {
    if (e.key === "zpzaken_cookie_consent") verwerkUetToestemming();
  });
  if (heeftMarketingToestemming() && !isNietGemetenPad(pathname)) {
    uetq()?.push("consent", "update", { ad_storage: "granted" });
    laadUet();
  }
}

/** SPA-paginaweergave voor UET bij elke routewissel (alleen als UET geladen is). */
let laatsteUetPagina: string | null = null;
export function uetPageView(pathname: string) {
  if (typeof window === "undefined" || isNietGemetenPad(pathname) || !heeftMarketingToestemming()) return;
  // Ook starten na een binnenkomst op een uitgesloten pad of een mislukte scriptdownload.
  const wasGeladen = uetGeladen;
  if (!uetGeladen) verwerkUetToestemming();
  // De eerste weergave telt UET zelf via pageLoad; effect-herhaling telt niet dubbel.
  if (!wasGeladen || laatsteUetPagina === null || laatsteUetPagina === pathname) {
    laatsteUetPagina = pathname;
    return;
  }
  laatsteUetPagina = pathname;
  uetq()?.push("event", "page_view", { page_path: pathname });
}

/** UET-conversie voor een afgeronde aanvraag; nooit voor testaanvragen of op interne paden. */
export function uetAanvraagAfgerond(isTest: boolean) {
  if (isTest || !uetGeladen || typeof window === "undefined" || isNietGemetenPad(window.location.pathname) || !heeftMarketingToestemming()) return;
  uetq()?.push("event", "aanvraag_afgerond", { event_category: "aanvraag" });
}

/** Alleen voor tests. */
export function __resetUetVoorTest(geladen = false) {
  uetGeladen = geladen;
  uetGeinstalleerd = false;
  laatsteUetPagina = null;
}

// ── OpenAI (ChatGPT Ads) meetpixel ──
/** OpenAI Ads-pixel-ID (register B2-aanvulling ChatGPT Ads). Automatic advanced matching staat uit. */
export const OPENAI_PIXEL_ID = "SxHpKs2V6EgSyfvtYJwquQ";
export const OPENAI_PIXEL_SRC = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
type Oaiq = ((...a: unknown[]) => void) & { q?: unknown[][] };
const oaiq = (): Oaiq | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { oaiq?: Oaiq }).oaiq);
let oaiGeladen = false;
let oaiGeinstalleerd = false;
let oaiLaatstePagina: string | null = null;

/** Zelfde stub als de officiële snippet, pas aangeroepen na marketingtoestemming en buiten interne paden. */
function laadOpenAiPixel() {
  if (oaiGeladen || typeof document === "undefined") return;
  oaiGeladen = true;
  const w = window as unknown as { oaiq?: Oaiq };
  if (!w.oaiq) {
    const wachtrij: unknown[][] = [];
    const q: Oaiq = (...args: unknown[]) => { wachtrij.push(args); };
    q.q = wachtrij;
    w.oaiq = q;
    const js = document.createElement("script");
    js.async = true;
    js.src = OPENAI_PIXEL_SRC;
    const f = document.getElementsByTagName("script")[0];
    if (f?.parentNode) f.parentNode.insertBefore(js, f); else document.head.appendChild(js);
  }
  w.oaiq?.("init", { pixelId: OPENAI_PIXEL_ID });
}

function verwerkOpenAiToestemming() {
  if (!heeftMarketingToestemming()) {
    oaiLaatstePagina = null;
    return;
  }
  openAiPageView(window.location.pathname, oaiHuidigePagina);
}

let oaiHuidigePagina = "initial";
/** Pixel laadt pas na toestemming marketingcookies (ook bij een latere keuze) en nooit op interne paden. */
export function installeerOpenAiPixel(pathname: string) {
  if (!OPENAI_PIXEL_ID || oaiGeinstalleerd || typeof window === "undefined") return;
  oaiGeinstalleerd = true;
  window.addEventListener("zp-cookie-keuze", verwerkOpenAiToestemming);
  window.addEventListener("storage", (e) => {
    if (e.key === "zpzaken_cookie_consent") verwerkOpenAiToestemming();
  });
  if (heeftMarketingToestemming() && !isNietGemetenPad(pathname)) laadOpenAiPixel();
}

/** Officieel standaardevent, zonder vrije tekst, URL-parameters of klantgegevens. */
export const OPENAI_PAGE_EVENT = ["measure", "page_viewed", { type: "contents" }] as const;

/** Eén weergave per SPA-navigatie; eerdere geweigerde pagina's worden nooit ingehaald. */
export function openAiPageView(pathname: string, navigatie = pathname) {
  oaiHuidigePagina = navigatie;
  if (typeof window === "undefined" || isNietGemetenPad(pathname) || !heeftMarketingToestemming()) {
    oaiLaatstePagina = null;
    return;
  }
  const sleutel = `${pathname}:${navigatie}`;
  if (oaiLaatstePagina === sleutel) return;
  laadOpenAiPixel();
  const pixel = oaiq();
  if (!pixel) return;
  const [cmd, ev, data] = OPENAI_PAGE_EVENT;
  pixel(cmd, ev, { ...data });
  oaiLaatstePagina = sleutel;
}

/** Exacte trackaanroep bij een afgeronde BAV + AVB-aanvraag (zonder persoonsgegevens). */
export const OPENAI_LEAD_EVENT = ["measure", "lead_created", { type: "customer_action" }] as const;

/** ChatGPT Ads-conversie; nooit voor testaanvragen, zonder toestemming of op interne paden. */
export function openAiAanvraagAfgerond(isTest: boolean, aanvraagId?: string) {
  if (isTest || !aanvraagId || typeof window === "undefined" || isNietGemetenPad(window.location.pathname)) return;
  if (!heeftMarketingToestemming()) return;
  laadOpenAiPixel();
  const [cmd, ev, data] = OPENAI_LEAD_EVENT;
  oaiq()?.(cmd, ev, { ...data }, { event_id: openaiLeadEventId(aanvraagId) });
}

/** Alleen voor tests. */
export function __resetOpenAiVoorTest(geladen = false) {
  oaiGeladen = geladen;
  oaiGeinstalleerd = false;
  oaiLaatstePagina = null;
  oaiHuidigePagina = "initial";
}

type Params = Record<string, string | number | boolean | undefined | unknown[]>;

/** Paden die nooit gemeten worden (ook met taalprefix). */
export function isNietGemetenPad(pathname: string): boolean {
  const p = pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
  return ["/admin", "/portal", "/mijn-zp", "/scherm", "/tv"].some((x) => p === x || p.startsWith(`${x}/`));
}

/** Zet de officiële opt-out-vlag (GA4 en Google Ads) voor het huidige pad. */
export function zetGaUitschakeling(pathname: string) {
  if (typeof window === "undefined") return;
  const uit = isNietGemetenPad(pathname);
  const w = window as unknown as Record<string, boolean>;
  w[`ga-disable-${GA_ID}`] = uit;
  w[`ga-disable-${GOOGLE_ADS_ID}`] = uit;
}

export function trackGa(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  if (isNietGemetenPad(window.location.pathname)) return;
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", event, params);
  if (import.meta.env.DEV) console.log(`[Track] ${event}`, params);
}

interface TrackingEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function trackEvent({ action, category, label, value }: TrackingEvent) {
  trackGa(action, { event_category: category, event_label: label, value });
}

// ── Contactklikken: één globale listener voor ALLE tel:- en wa.me-links ──
let contactListener = false;
export function installeerContactKlikMeting() {
  if (typeof document === "undefined" || contactListener) return;
  contactListener = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const page = window.location.pathname;
      if (href.startsWith("tel:")) trackGa("phone_click", { page, link_text: (a.textContent || "").trim().slice(0, 60) });
      else if (/^https?:\/\/(api\.)?wa\.me\//.test(href)) trackGa("whatsapp_click", { page });
    },
    { capture: true },
  );
}

/** @deprecated gemeten via installeerContactKlikMeting (voorkomt dubbele events). */
export const trackPhone = () => {};
/** @deprecated gemeten via installeerContactKlikMeting (voorkomt dubbele events). */
export const trackWhatsApp = () => {};

export const trackCTA = (label: string) => {
  trackEvent({ action: "cta_click", category: "conversion", label });
  if (label.includes("gesprek") || label.includes("advies")) {
    trackEvent({ action: "adviesgesprek_click", category: "lead", label: "adviesgesprek CTA geklikt" });
  }
};

export const trackFormStart = (form: string) =>
  trackEvent({ action: "form_start", category: "lead", label: form });

export const trackFormComplete = (form: string) =>
  trackEvent({ action: "form_complete", category: "lead", label: form });

export const trackQualificationResult = (qualified: boolean, branch: string) =>
  trackEvent({ action: qualified ? "qualified" : "not_qualified", category: "qualification", label: branch });

export const trackContactFormSubmit = () =>
  trackEvent({ action: "contact_form_submit", category: "lead", label: "contactformulier verzonden" });

// ── BAV-wizard (geen persoonsgegevens in parameters) ──
const page = () => (typeof window === "undefined" ? "" : window.location.pathname);

export const trackBeginCheckout = (pakket: string, sector: string) =>
  trackGa("begin_checkout", { pakket, page: page(), sector: sector || "(nog niet gekozen)" });

export const trackWizardStep = (step: number, step_name: string) =>
  trackGa("wizard_step", { step, step_name, page: page() });

/** Vaste korte namen per stap van de BAV + AVB-aanvraag (geen vrije tekst). */
export const AANVRAAG_STAP_NAMEN = ["pakket", "bedrijf", "gegevens", "betaling", "controle"] as const;

/** Parameters van aanvraag_stap: alleen stapnummer en vaste stapnaam, nooit persoonsgegevens. */
export function aanvraagStapParams(stap: number): { stap: number; stap_naam: string } | null {
  if (!Number.isInteger(stap) || stap < 1 || stap > AANVRAAG_STAP_NAMEN.length) return null;
  return { stap, stap_naam: AANVRAAG_STAP_NAMEN[stap - 1] };
}

/** GA4-event bij het bereiken van een stap; via trackGa, dus zelfde consent-route als de andere events. */
export function trackAanvraagStap(stap: number) {
  const params = aanvraagStapParams(stap);
  if (params) trackGa("aanvraag_stap", params);
}

export const trackWizardValidationError = (step: number, veldnaam: string) =>
  trackGa("wizard_validation_error", { step, veldnaam, page: page() });

export const trackAddPaymentInfo = (pakket: string, value: number) =>
  trackGa("add_payment_info", { payment_type: "sepa", pakket, value, currency: "EUR" });

/** Jaarpremie uit bavPakketten: maandpakket x 12, jaarpakket = prijs. */
export const jaarpremie = (p: { prijs: number; periode: "maand" | "jaar" }) => (p.periode === "maand" ? p.prijs * 12 : p.prijs);

/** NL-telefoonnummer in E.164 (bv. +31612345678); ongeldig of leeg levert "" op. */
export function e164Telefoon(v: string | undefined | null): string {
  const n = normaliseerNlTelefoon(v ?? "");
  if (!isNlTelefoon(n)) return "";
  return `+31${n.replace(/^0/, "")}`;
}

const PURCHASE_KEY = "zp_purchase_verstuurd";

/** Enhanced conversions: genormaliseerd e-mailadres (getrimd, kleine letters). */
export function normaliseerEmailVoorHash(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

/** SHA-256 (hex) van het genormaliseerde e-mailadres, in de browser via crypto.subtle; leeg of geen subtle geeft null. */
export async function sha256EmailHex(email: string | undefined | null): Promise<string | null> {
  const n = normaliseerEmailVoorHash(email);
  const subtle = globalThis.crypto?.subtle;
  if (!n || !n.includes("@") || !subtle) return null;
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(n));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}


/**
 * purchase vuurt maximaal één keer per transaction_id (ook na herladen in dezelfde browser).
 * Enhanced conversions (C8): alleen bij deze afgeronde BAV + AVB-aanvraag, met marketingtoestemming en
 * buiten interne paden, eerst gtag('set','user_data',{ sha256_email_address }). Alleen de hash van het
 * e-mailadres; nooit naam, telefoon, adres of leesbaar e-mailadres naar Google of de dataLayer.
 */
export const trackPurchase = (
  transactionId: string,
  pakketId: string,
  pakketNaam: string,
  value: number,
  userData?: { email?: string },
  isTest = false,
): void | Promise<void> => {
  try {
    const al: string[] = JSON.parse(localStorage.getItem(PURCHASE_KEY) || "[]");
    if (al.includes(transactionId)) return;
    localStorage.setItem(PURCHASE_KEY, JSON.stringify([...al, transactionId].slice(-20)));
  } catch { /* geen opslag: toch één keer versturen */ }
  const verstuur = (hash: string | null) => {
    if (hash) {
      const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
      if (typeof gtag === "function") gtag("set", "user_data", { sha256_email_address: hash });
    }
    trackGa("purchase", {
      transaction_id: transactionId,
      value,
      currency: "EUR",
      items: [{ item_id: pakketId, item_name: pakketNaam, price: value, quantity: 1 }],
    });
    if (adsSendTo(GOOGLE_ADS_CONVERSIE.split("/")[1] ?? "") === GOOGLE_ADS_CONVERSIE) trackGa("conversion", {
      send_to: GOOGLE_ADS_CONVERSIE,
      value,
      currency: "EUR",
      transaction_id: transactionId,
    });
    uetAanvraagAfgerond(isTest);
    openAiAanvraagAfgerond(isTest, transactionId);
  };
  const magHashen =
    typeof window !== "undefined" &&
    !!normaliseerEmailVoorHash(userData?.email) &&
    !isNietGemetenPad(window.location.pathname) &&
    heeftMarketingToestemming();
  if (!magHashen) return verstuur(null);
  return sha256EmailHex(userData?.email).catch(() => null).then(verstuur);
};


/** Productie = zpzaken.nl (zelfde regel als de server voor is_test). */
export function isTestOmgeving(host: string = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  const h = host.toLowerCase();
  return !(h === "zpzaken.nl" || h.endsWith(".zpzaken.nl"));
}

/** Secundair UET-event (alleen met geladen UET, dus na marketingtoestemming). */
export function uetSecundair(event: string, isTest: boolean) {
  if (isTest || !uetGeladen || typeof window === "undefined" || isNietGemetenPad(window.location.pathname) || !heeftMarketingToestemming()) return;
  uetq()?.push("event", event, { event_category: "lead" });
}

export function secundaireConversie(event: string, formulier: string, label: string, isTest: boolean) {
  if (isTest || typeof window === "undefined" || isNietGemetenPad(window.location.pathname)) return;
  trackGa(event, { formulier, page: page() });
  const sendTo = adsSendTo(label);
  if (sendTo) trackGa("conversion", { send_to: sendTo });
  uetSecundair(event, isTest);
}

/** Alleen aanroepen na een geslaagde server-respons. */
export const trackTerugbelVerzonden = (isTest = isTestOmgeving()) =>
  secundaireConversie("terugbelverzoek_verzonden", "terugbel", GOOGLE_ADS_CONVERSIE_TERUGBEL, isTest);
/** Alleen aanroepen na een geslaagde server-respons. */
export const trackContactVerzonden = (isTest = isTestOmgeving()) =>
  secundaireConversie("contactformulier_verzonden", "contact", GOOGLE_ADS_CONVERSIE_CONTACT, isTest);
/** Offerteverzoek: alleen UET-event (geen Google Ads-label ingesteld). */
export const trackOfferteVerzonden = (isTest = isTestOmgeving()) => uetSecundair("offerte_verzonden", isTest);

/**
 * Secundaire conversie "aanvraag gestart": eerste keer dat een aanvraagconcept met e-mail of telefoon is opgeslagen.
 * Label van de Google Ads-actie "Aanvraag gestart" hier invullen; leeg = alleen GA4-event, geen Ads-conversie.
 */
export const GOOGLE_ADS_CONVERSIE_AANVRAAG_GESTART = "";
const GESTART_KEY = "zp_aanvraag_gestart";

/** Maximaal één keer per concept-id (ook na herladen). Nooit persoonsgegevens in parameters. */
export function trackAanvraagGestart(conceptId: string, isTest = isTestOmgeving()) {
  if (!conceptId || isTest || typeof window === "undefined" || isNietGemetenPad(window.location.pathname)) return;
  try {
    const al: string[] = JSON.parse(localStorage.getItem(GESTART_KEY) || "[]");
    if (al.includes(conceptId)) return;
    localStorage.setItem(GESTART_KEY, JSON.stringify([...al, conceptId].slice(-20)));
  } catch { /* geen opslag: toch één keer per paginaweergave */ }
  secundaireConversie("aanvraag_gestart", "aanvraag", GOOGLE_ADS_CONVERSIE_AANVRAAG_GESTART, false);
  if (uetGeladen && heeftMarketingToestemming()) uetq()?.push("event", "aanvraag_gestart", { event_category: "aanvraag" });
}

/** Interesse pensioen via Evi verstuurd: alleen GA4, bewust geen Ads-label. */
export function trackEviInteresseVerstuurd(isTest = isTestOmgeving()) {
  if (isTest) return;
  trackGa("evi_interesse_verstuurd", { formulier: "evi", page: page() });
}

export type LeadFormulier = "offerte" | "contact" | "terugbel" | "aanvraag";
export const trackGenerateLead = (formulier: LeadFormulier) =>
  trackGa("generate_lead", { formulier, page: page(), value: 0, currency: "EUR" });

// ── Chat Zeker ──
export const trackChatOpen = () => trackGa("chat_open", { page: page() });
export const trackChatHandoff = (methode: string) => trackGa("chat_handoff", { methode, page: page() });
