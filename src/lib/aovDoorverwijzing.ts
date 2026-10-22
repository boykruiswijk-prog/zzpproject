import { AOV_ADVISEUR_URL, AOV_REKENTOOL_URL } from "@/config/aovPagina";
export type AovDoel = "rekentool" | "advies";
export interface AovKlik { klik_id: string; bron: string; doel: AovDoel; user_id: string | null; klant_ref: string | null }

export function aovBron(pad: string, landing: Record<string, unknown> | null, test = false): string {
  if (test) return "test";
  const p = typeof landing?.landingspagina === "string" ? landing.landingspagina : pad;
  const veiligPad = /^\/[a-zA-Z0-9/_-]*$/.test(p) ? p.slice(0, 200) : "/aov";
  const q = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = landing?.[key];
    // Alleen campagnecodes, geen vrije tekst, mailadressen of queryparameters.
    if (typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v)) q.set(key, v);
  }
  if (veiligPad === "/movir" && !q.has("utm_source")) q.set("utm_source", "nn");
  return veiligPad + (q.size ? `?${q}` : "");
}

export function aovLink(doel: AovDoel, klikId: string): string {
  const url = new URL(doel === "rekentool" ? AOV_REKENTOOL_URL : AOV_ADVISEUR_URL);
  url.searchParams.set("utm_source", "zpzaken");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "aov");
  url.searchParams.set("ref", klikId);
  return url.toString();
}

/** Registratie mag navigatie niet vertragen; ook synchrone fouten worden opgevangen. */
export function aovDoorklik(rij: AovKlik, schrijf: (rij: AovKlik) => PromiseLike<unknown>, open: (url: string) => void) {
  open(aovLink(rij.doel, rij.klik_id));
  try { void Promise.resolve(schrijf(rij)).catch(() => {}); } catch { /* doorklik blijft werken */ }
}

export function aovAnalyticsToestemming(): boolean {
  try {
    const p = JSON.parse(localStorage.getItem("zpzaken_cookie_consent") || "null");
    return p?.version === "1.0" && p?.analytics === true;
  } catch { return false; }
}

export interface AovOverzichtRij extends AovKlik { id: string; created_at: string; klant_naam: string | null }
export function aovWeek(datum: string): string {
  // Kalenderdag in Nederland; weken beginnen op maandag.
  const delen = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date(datum));
  const d = new Date(`${delen}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export function aovWeekTotalen(rijen: AovOverzichtRij[]) {
  const weken = new Map<string, number>();
  for (const r of rijen) { const w = aovWeek(r.created_at); weken.set(w, (weken.get(w) || 0) + 1); }
  return [...weken.entries()].sort(([a], [b]) => b.localeCompare(a));
}
export function aovCsv(rijen: AovOverzichtRij[]): string {
  const cel = (v: string) => `"${(/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  return "\uFEFF" + [["Datum/tijd", "Doel", "Bron", "Klant", "Klantnummer", "Klik_id"], ...rijen.map(r => [r.created_at, r.doel, r.bron, r.user_id ? r.klant_naam || r.klant_ref || r.user_id : "anoniem", r.klant_ref || "", r.klik_id])].map(r => r.map(cel).join(";")).join("\r\n");
}
// F9-aanvulling 4: ZP Zaken als aanbrenger. Uitsluitend contactgegevens en toestemming, nooit AOV-inhoud.
export const AOV_AANMELD_VELDEN = ["naam", "email", "telefoon", "toestemming"] as const;
export interface AovAanmelding { naam: string; email: string; telefoon: string; toestemming: boolean }
export function aovAanmeldFouten(a: AovAanmelding): Partial<Record<keyof AovAanmelding, string>> {
  const f: Partial<Record<keyof AovAanmelding, string>> = {};
  const naam = a.naam.trim();
  if (naam.length < 2 || naam.length > 120) f.naam = "Vul je naam in.";
  const email = a.email.trim();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email)) f.email = "Vul een geldig e-mailadres in.";
  const tel = a.telefoon.trim();
  if (tel && !/^[0-9+ ()-]{8,20}$/.test(tel)) f.telefoon = "Vul een geldig telefoonnummer in of laat dit veld leeg.";
  if (a.toestemming !== true) f.toestemming = "Zet het vinkje om verder te gaan.";
  return f;
}
export interface AovAanmeldOverzichtRij { id: string; created_at: string; naam: string; email: string; telefoon: string | null; doel: string; bron: string; user_id: string | null; status: string; notitie: string | null; behandeld_op: string | null; lead_id: string | null; lead_status: string | null }
export const AOV_STATUSSEN = { nieuw: "Nieuw", doorgegeven: "Doorgegeven", polis: "Polis", geen_polis: "Geen polis" } as const;
export function aovKopieTekst(r: Pick<AovAanmeldOverzichtRij, "naam" | "email" | "telefoon" | "id">): string {
  return [`Naam: ${r.naam}`, `E-mail: ${r.email}`, `Telefoon: ${r.telefoon || "-"}`, `Ref: ${r.id}`].join("\n");
}
export function aovAanmeldCsv(rijen: AovAanmeldOverzichtRij[]): string {
  const cel = (v: string) => `"${(/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  return "\uFEFF" + [["Datum/tijd", "Naam", "E-mail", "Telefoon", "Doel", "Bron", "Bestaande klant", "Ref", "Status", "Notitie"],
    ...rijen.map(r => [r.created_at, r.naam, r.email, r.telefoon || "", r.doel, r.bron, r.lead_id ? "ja" : "nee", r.id, r.status, r.notitie || ""])]
    .map(r => r.map(cel).join(";")).join("\r\n");
}
