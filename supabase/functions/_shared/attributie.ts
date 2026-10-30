// Herkomst van een lead (first-party, per browsersessie vastgelegd).
// Gedeeld door frontend (src/lib/attributie.ts) en Edge Functions
// (submit-public-form, process-bav-wizard). Geen persoonsgegevens.

export const AI_VERWIJZERS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
] as const;

export const ATTRIBUTIE_SLEUTELS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "gbraid", "wbraid", "msclkid", "oppref", "referrer", "landingspagina", "eerste_bezoek_op",
  // Alleen "google", "microsoft" of "openai": kanaal zonder klik-ID (ook zonder marketingtoestemming).
  "advertentieklik", "herkomst_uit",
] as const;

/** Advertentie-klik-ID's: alleen opgeslagen en verstuurd na toestemming marketing-cookies. */
export const KLIK_ID_SLEUTELS = ["gclid", "gbraid", "wbraid", "msclkid", "oppref"] as const;
/** Toegestane tekens per klik-ID (OpenAI oppref kan ook punten en tildes bevatten). */
export const KLIK_ID_PATROON = /^[\w.~-]{1,300}$/;
/** ChatGPT Ads: utm_source=chatgpt (exact; organisch ChatGPT gebruikt chatgpt.com), oppref of advertentieklik openai. */
export function isChatgptAds(a: Partial<Record<string, string>>): boolean {
  return (a.utm_source ?? "").trim().toLowerCase() === "chatgpt" || !!a.oppref || a.advertentieklik === "openai";
}
export type KlikIdSleutel = (typeof KLIK_ID_SLEUTELS)[number];

export type AttributieSleutel = (typeof ATTRIBUTIE_SLEUTELS)[number];
export type Kanaal = "herinnering" | "chatgpt_ads" | "ai" | "betaald" | "campagne" | "verwijzing" | "direct";
export type Attributie = Partial<Record<AttributieSleutel, string>> & { kanaal: Kanaal; marketing_toestemming?: boolean };

function host(v: string): string {
  try { return new URL(v.includes("://") ? v : `https://${v}`).hostname.toLowerCase(); } catch { return ""; }
}

/** Is dit een bekende AI-assistent (referrer-URL of utm_source zoals "chatgpt.com")? */
export function isAiVerwijzer(v: string | undefined | null): boolean {
  if (!v) return false;
  const h = host(v.trim());
  return !!h && AI_VERWIJZERS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** A20: terugkeer via de herinneringsmail voor een afgehaakte aanvraag (utm_source=herinnering). */
export function isHerinnering(a: Partial<Record<string, string>>): boolean {
  return (a.utm_source ?? "").trim().toLowerCase() === "herinnering";
}

export function bepaalKanaal(a: Partial<Record<AttributieSleutel, string>>): Kanaal {
  if (isHerinnering(a)) return "herinnering";
  if (isChatgptAds(a)) return "chatgpt_ads";
  if (isAiVerwijzer(a.referrer) || isAiVerwijzer(a.utm_source)) return "ai";
  if (a.gclid || a.gbraid || a.wbraid || a.msclkid || a.advertentieklik) return "betaald";
  if (a.utm_source) return "campagne";
  if (a.referrer) return "verwijzing";
  return "direct";
}

/** Referrer zonder query/hash (kan persoonsgegevens bevatten). */
export function schoneUrl(v: string): string {
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return "";
    return `${u.origin}${u.pathname}`.slice(0, 300);
  } catch { return ""; }
}

/** Server-side opschonen: alleen bekende sleutels, korte strings, kanaal herberekend. */
export function saneerAttributie(x: unknown): Attributie | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const uit: Partial<Record<AttributieSleutel, string>> = {};
  for (const k of ATTRIBUTIE_SLEUTELS) {
    const v = r[k];
    if (typeof v !== "string") continue;
    let s = v.trim().slice(0, k === "referrer" || k === "landingspagina" ? 300 : 200);
    if ((KLIK_ID_SLEUTELS as readonly string[]).includes(k)) s = KLIK_ID_PATROON.test(s) ? s : "";
    if (k === "referrer") s = schoneUrl(s);
    if (k === "landingspagina") s = s.startsWith("/") ? s.split(/[?#]/)[0] : "";
    if (k === "advertentieklik") s = s === "google" || s === "microsoft" || s === "openai" ? s : "";
    if (k === "herkomst_uit") s = s === "90d" ? s : "";
    if (k === "eerste_bezoek_op") s = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s) ? s : "";
    if (s) uit[k] = s;
  }
  const marketing = typeof r.marketing_toestemming === "boolean" ? { marketing_toestemming: r.marketing_toestemming } : {};
  if (!Object.keys(uit).length && !Object.keys(marketing).length) return null;
  return { ...uit, ...marketing, kanaal: bepaalKanaal(uit) };
}

export const KANAAL_LABEL: Record<Kanaal, string> = {
  herinnering: "Herinneringsmail", chatgpt_ads: "ChatGPT Ads", ai: "AI-assistent", betaald: "Google Ads", campagne: "Campagne", verwijzing: "Verwijzing", direct: "Direct / onbekend",
};

/** Regels voor de leaddetailpagina (blok Aanvraag) en de teammail. */
export function attributieRegels(x: unknown): Array<[string, string]> {
  const a = saneerAttributie(x);
  if (!a) return [];
  const utm = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / ");
  const klik = a.gclid ? "gclid" : a.gbraid ? "gbraid" : a.wbraid ? "wbraid" : "";
  const bron = a.kanaal === "betaald" && !klik && (a.msclkid || a.advertentieklik === "microsoft") ? "Microsoft Ads" : KANAAL_LABEL[a.kanaal];
  return ([
    ["Bron", bron],
    ["Verwijzer", a.referrer ?? ""],
    ["Campagne (utm)", utm],
    ["Zoekterm (utm_term)", a.utm_term ?? ""],
    ["Advertentie (utm_content)", a.utm_content ?? ""],
    ["Google Ads-klik", klik],
    ["Microsoft Ads-klik", a.msclkid ? "msclkid" : ""],
    ["ChatGPT Ads-klik", a.oppref ? "oppref" : ""],
    ["Landingspagina", a.landingspagina ?? ""],
  ] as Array<[string, string]>).filter(([, w]) => !!w);
}
