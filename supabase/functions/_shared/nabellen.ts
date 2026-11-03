// Pure regels voor de nabel-melding van niet-afgeronde aanvragen (aanvraag_concepten).
// Gedeeld met de vitest-tests; geen Deno- of browser-API's.

// Besluit Boy 3-11: de 30-minuten "Nabellen"-mail vervalt; afhakers krijgen een herinneringsmail en
// het team krijgt pas daarna een melding (bouwHerinneringMelding).
export const NABEL_WACHT_MINUTEN = 30;
export const HERINNERING_MELDING_ONDERWERP = "Afgehaakte aanvraag: herinnering verstuurd";
export const HERINNERING_MELDING_TEKST = "Deze bezoeker heeft een herinneringsmail ontvangen om de aanvraag af te maken. Je hoeft niet te bellen.";
export const NABEL_ADMIN_LINK = "https://zpzaken.nl/admin/afgehaakt";

export type NabelConcept = {
  id: string;
  status: string | null;
  is_test: boolean | null;
  lead_id: string | null;
  dubbel_lead_id: string | null;
  telefoon: string | null;
  email: string | null;
  laatst_actief_op: string | null;
  team_gemeld_op: string | null;
  geanonimiseerd_op?: string | null;
  voornaam?: string | null;
  achternaam?: string | null;
  bedrijfsnaam?: string | null;
  pakket?: string | null;
  stap?: number | null;
  max_stap?: number | null;
  attributie?: Record<string, unknown> | null;
};

/** Interne testadressen (@zpzaken.nl) gelden altijd als test: nooit nabellen. */
export function isInternTestEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith("@zpzaken.nl");
}

/** Zelfde voorwaarden als de databasequery; dubbele controle vóór het mailen. */
export function moetNabellen(c: NabelConcept, nu: Date = new Date()): boolean {
  if (c.status !== "open" || c.is_test !== false) return false;
  if (c.lead_id || c.dubbel_lead_id || c.team_gemeld_op || c.geanonimiseerd_op) return false;
  if (isInternTestEmail(c.email)) return false;
  if (!(c.telefoon?.trim() || c.email?.trim())) return false;
  if (!c.laatst_actief_op) return false;
  return new Date(c.laatst_actief_op).getTime() < nu.getTime() - NABEL_WACHT_MINUTEN * 60_000;
}

export function herkomstTekst(a: Record<string, unknown> | null | undefined): string {
  if (!a || typeof a !== "object") return "Onbekend";
  const s = (k: string) => (typeof a[k] === "string" && (a[k] as string).trim() ? (a[k] as string).trim() : "");
  const bron = s("utm_source");
  const kanaal = s("kanaal") || s("utm_medium");
  const delen = [bron && `bron ${bron}`, kanaal && `kanaal ${kanaal}`, s("utm_campaign") && `campagne ${s("utm_campaign")}`].filter(Boolean);
  if (delen.length) return delen.join(", ");
  if (s("advertentieklik")) return `advertentieklik ${s("advertentieklik")}`;
  if (s("referrer")) return `verwijzer ${s("referrer")}`;
  return "Direct of onbekend";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function tijdNL(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function bouwHerinneringMelding(c: NabelConcept, verstuurdOp: string) {
  const naam = [c.voornaam, c.achternaam].filter((x) => x && x.trim()).join(" ") || "-";
  const tel = c.telefoon?.trim() || "-";
  const link = `${NABEL_ADMIN_LINK}?record=${encodeURIComponent(c.id)}`;
  const rijen: [string, string][] = [
    ["Naam", naam],
    ["Bedrijfsnaam", c.bedrijfsnaam?.trim() || "-"],
    ["E-mail", c.email?.trim() || "-"],
    ["Telefoon", tel],
    ["Pakket", c.pakket?.trim() || "-"],
    ["Hoogste stap", `${c.max_stap ?? c.stap ?? "-"} van 5`],
    ["Herkomst", herkomstTekst(c.attributie)],
    ["Herinnering verstuurd", tijdNL(verstuurdOp)],
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;max-width:600px">
<h2 style="margin:0 0 12px;font-size:18px">${HERINNERING_MELDING_ONDERWERP}</h2>
<p style="margin:0 0 12px">${HERINNERING_MELDING_TEKST}</p>
<table style="border-collapse:collapse">${rijen.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#666">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join("")}</table>
<p style="margin:16px 0 0"><a href="${link}" style="color:#E53E2F">Open in de admin</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#666">Interne melding van ZP Zaken.</p>
</div>`;
  const text = [HERINNERING_MELDING_ONDERWERP, "", HERINNERING_MELDING_TEKST, "", ...rijen.map(([k, v]) => `${k}: ${v}`), "", `Admin: ${link}`].join("\n");
  return { subject: HERINNERING_MELDING_ONDERWERP, html, text };
}

/** Veldnamen voor de validatielog: alleen letters, nooit waarden. */
export function schoneVeldnamen(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && /^[A-Za-z]{1,40}$/.test(x)))].slice(0, 20);
}
