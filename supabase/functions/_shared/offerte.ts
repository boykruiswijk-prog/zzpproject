// Offertemail BAV + AVB (pure helper). Bedragen spiegelen src/data/bavPakketten.ts.
// Geen uitspraken over dekkingsgebied: dat bespreekt het team zelf.
import { COMPANY } from "./company.ts";

export const OFFERTE = {
  pakket: "BAV + AVB combinatiepolis",
  verzekeraar: "Hiscox",
  bav: "EUR 5.000.000",
  avb: "EUR 2.500.000",
  maand: "55 euro per maand",
  jaar: "600 euro per jaar",
} as const;

const SECTOR_PAD: Record<string, string> = { ict: "/zzp-verzekering-ict" };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function afsluitLink(sector: string): string {
  const pad = SECTOR_PAD[sector.toLowerCase()] ?? "/";
  return `${COMPANY.url}${pad}#combinatiepolis`;
}

export function offerteHtml(o: { voornaam: string; bedrijfsnaam: string; sector: string; engels: boolean }): string {
  const link = afsluitLink(o.sector);
  const engels = o.engels
    ? `<p style="background:#f5f5f5;padding:12px;border-radius:6px">Thank you for your request. Below you will find our quote for professional and general liability insurance (BAV and AVB) in one policy. The BAV cover of EUR 5,000,000 per claim exceeds the EUR 600,000 you asked for. Questions? Reply to this email or call +31 20 457 3077.</p>`
    : "";
  return `<!doctype html><html lang="nl"><body style="font-family:Arial,sans-serif;color:#1a1a1a"><div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6">
<p style="font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken</p>
${engels}
<p>Hoi ${esc(o.voornaam || "")},</p>
<p>Bedankt voor je offerteaanvraag${o.bedrijfsnaam ? ` voor ${esc(o.bedrijfsnaam)}` : ""}. Hieronder vind je onze offerte.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:6px 0;color:#555">Verzekering</td><td style="padding:6px 0"><strong>BAV en AVB in een polis</strong></td></tr>
<tr><td style="padding:6px 0;color:#555">Verzekeraar</td><td style="padding:6px 0">${OFFERTE.verzekeraar}</td></tr>
<tr><td style="padding:6px 0;color:#555">Beroepsaansprakelijkheid (BAV)</td><td style="padding:6px 0">${OFFERTE.bav} per gebeurtenis</td></tr>
<tr><td style="padding:6px 0;color:#555">Bedrijfsaansprakelijkheid (AVB)</td><td style="padding:6px 0">${OFFERTE.avb} per gebeurtenis</td></tr>
<tr><td style="padding:6px 0;color:#555">Eigen risico</td><td style="padding:6px 0">Geen</td></tr>
<tr><td style="padding:6px 0;color:#555">Premie</td><td style="padding:6px 0">${OFFERTE.maand} of ${OFFERTE.jaar}, inclusief kosten en assurantiebelasting</td></tr>
<tr><td style="padding:6px 0;color:#555">Looptijd</td><td style="padding:6px 0">Dagelijks opzegbaar</td></tr>
</table>
<p style="margin:24px 0"><a href="${link}" style="background:#E53E2F;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Direct afsluiten</a></p>
<p>Vragen? Antwoord op deze mail of bel ${COMPANY.phoneDisplay}.</p>
<p>Groet,<br>${esc(COMPANY.legalName)}</p>
<p style="font-size:12px;color:#777">AFM ${COMPANY.registrations.afm} · KvK ${COMPANY.registrations.kvk} · Kifid ${COMPANY.registrations.kifid}</p>
</div></body></html>`;
}
