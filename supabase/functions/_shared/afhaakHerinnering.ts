// A20-aanvulling 1: tekst en opmaak van de eenmalige herinneringsmail voor een afgehaakte aanvraag.
// Pure helper (geen Deno), zelfde opmaak als de andere klantmails. Tekst exact volgens besluit Boy.

export const AFHAAK_LEAD_TYPE = "afhaak_herinnering";
export const AFHAAK_ONDERWERP = "Je aanvraag bij ZP Zaken staat nog open";
export const AFHAAK_AFZENDER_NAAM = "Ellen Baars | ZP Zaken";
export const AFHAAK_REPLY_TO = "ellen.baars@zpzaken.nl";
export const AFHAAK_KNOP = "Verder met mijn aanvraag";
// Geen server-hervatlink: het concept-id staat alleen in de browser van de bezoeker. Daarom naar de
// BAV + AVB-aanvraagpagina met alleen campagneparameters, nooit persoonsgegevens in de URL.
export const AFHAAK_URL = "https://zpzaken.nl/verzekeringen?utm_source=herinnering&utm_medium=email&utm_campaign=afhaak";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function afhaakAanhef(voornaam?: string | null): string {
  const n = (voornaam ?? "").trim();
  return n ? `Hoi ${n},` : "Hoi,";
}

/** Afzender "Ellen Baars | ZP Zaken" op het bestaande afzenderadres (domein ongewijzigd). */
export function afhaakAfzender(from: string): string {
  const m = from.match(/<([^>]+)>/);
  const adres = (m ? m[1] : from).trim();
  return `${AFHAAK_AFZENDER_NAAM} <${adres}>`;
}

export function afhaakTekst(voornaam?: string | null): string {
  return `${afhaakAanhef(voornaam)}

Je was bezig met je aanvraag voor de BAV + AVB bij ZP Zaken, maar die is nog niet afgerond. Misschien kwam er iets tussen, of liep je ergens tegenaan.

Je kunt verder waar je gebleven was: ${AFHAAK_KNOP}: ${AFHAAK_URL}

Heb je een vraag over de dekking of het formulier? Bel me gerust op 020 - 457 3077 of beantwoord deze mail.

Met vriendelijke groet,
Ellen Baars
ZP Zaken`;
}

export function afhaakHtml(voornaam?: string | null): string {
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-size:15px;line-height:1.6">
<p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken</p>
<p style="margin:0 0 16px">${esc(afhaakAanhef(voornaam))}</p>
<p style="margin:0 0 16px">Je was bezig met je aanvraag voor de BAV + AVB bij ZP Zaken, maar die is nog niet afgerond. Misschien kwam er iets tussen, of liep je ergens tegenaan.</p>
<p style="margin:0 0 8px">Je kunt verder waar je gebleven was:</p>
<p style="margin:0 0 24px"><a href="${esc(AFHAAK_URL)}" style="display:inline-block;background:#E53E2F;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${AFHAAK_KNOP}</a></p>
<p style="margin:0 0 16px">Heb je een vraag over de dekking of het formulier? Bel me gerust op 020 - 457 3077 of beantwoord deze mail.</p>
<p style="margin:0">Met vriendelijke groet,<br>Ellen Baars<br>ZP Zaken</p>
</div></body></html>`;
}

/** Volledige Resend-body; reply_to altijd Ellen. */
export function afhaakResendBody(p: { from: string; to: string[]; subject: string; html: string; voornaam?: string | null }) {
  return { from: afhaakAfzender(p.from), to: p.to, reply_to: AFHAAK_REPLY_TO, subject: p.subject, html: p.html, text: afhaakTekst(p.voornaam) };
}
