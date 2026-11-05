// A30 Lasso / Opvolger: bouwt de ene gebundelde interne mail per ronde. Nooit een klantmail.
export type OpvolgItem = { soort: "concept" | "terugbel" | "offerte"; id: string; signaal: 1 | 2; uren_open: number; stap: number | null; pakket: string | null };

/** Interne meldingssoort; ontvangers Ellen en info@ staan in interne_melding_ontvangers. */
export const OPVOLGER_SOORT = "opvolger";
export const OPVOLGER_ONTVANGERS_STANDAARD = ["ellen.baars@zpzaken.nl", "info@zpzaken.nl"];

const SOORT_LABEL: Record<OpvolgItem["soort"], string> = { concept: "Afgehaakte aanvraag", terugbel: "Terugbelverzoek", offerte: "Offerte-aanvraag" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function adminLink(item: Pick<OpvolgItem, "soort" | "id">, basis = "https://zpzaken.nl"): string {
  return item.soort === "concept" ? `${basis}/admin/afgehaakt?id=${item.id}` : `${basis}/admin/leads/${item.id}`;
}

export function urenTekst(u: number): string {
  if (u >= 48) return `${Math.floor(u / 24)} dagen`;
  return `${Math.round(u)} uur`;
}

/** Eén mail per ronde met alle nieuw te melden items; null als er niets te melden is. */
export function bouwOpvolgMail(items: OpvolgItem[]): { subject: string; html: string; text: string } | null {
  if (!items.length) return null;
  const regels = items.map((i) => ({
    soort: SOORT_LABEL[i.soort] + (i.signaal === 2 ? " (tweede signaal)" : ""),
    open: urenTekst(i.uren_open), stap: i.stap != null ? `stap ${i.stap}` : "-", pakket: i.pakket || "-", link: adminLink(i),
  }));
  const html = `<p>Lasso ziet ${items.length} ${items.length === 1 ? "item" : "items"} dat nog niet is opgevolgd.</p>`
    + `<table cellpadding="6" style="border-collapse:collapse"><tr><th align="left">Soort</th><th align="left">Open</th><th align="left">Afgehaakt bij</th><th align="left">Pakket</th><th></th></tr>`
    + regels.map((r) => `<tr><td>${esc(r.soort)}</td><td>${esc(r.open)}</td><td>${esc(r.stap)}</td><td>${esc(r.pakket)}</td><td><a href="${r.link}">Openen</a></td></tr>`).join("")
    + `</table><p>Alle open items staan in het overzicht Opvolgen in de admin.</p>`;
  const text = regels.map((r) => `${r.soort} | open ${r.open} | ${r.stap} | ${r.pakket} | ${r.link}`).join("\n");
  return { subject: `Lasso: ${items.length} ${items.length === 1 ? "item" : "items"} opvolgen`, html, text };
}
