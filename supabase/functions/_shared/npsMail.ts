// Tekst en opmaak van het NPS-verzoek (A22-aanvulling NPS). Pure helper, zelfde opmaak en voettekst als reviewMail.
// Geen review-gating: de NPS-pagina linkt nooit naar Google-reviews.

export const NPS_ONDERWERP = "Eén vraag van Ellen";
export const NPS_VRAAG = "Je bent nu een maand klant bij ZP Zaken. Hoe waarschijnlijk is het dat je ons aanraadt aan een andere zzp'er?";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function npsScoreUrl(basis: string, token: string, score: number): string {
  return `${basis}?t=${encodeURIComponent(token)}&s=${score}`;
}

export function npsHtml(p: { voornaam?: string | null; token: string; paginaUrl: string; afmeldUrl: string }): string {
  const naam = (p.voornaam ?? "").trim();
  const aanhef = naam ? `Hoi ${esc(naam)},` : "Hoi,";
  const knoppen = Array.from({ length: 11 }, (_, i) =>
    `<td style="padding:2px"><a href="${esc(npsScoreUrl(p.paginaUrl, p.token, i))}" style="display:block;width:34px;line-height:34px;text-align:center;background:#E53E2F;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:6px">${i}</a></td>`).join("");
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-size:15px;line-height:1.6">
<p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken</p>
<p style="margin:0 0 16px">${aanhef}</p>
<p style="margin:0 0 24px">${NPS_VRAAG}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 6px"><tr>${knoppen}</tr></table>
<table role="presentation" width="100%" style="margin:0 0 24px;font-size:12px;color:#777777"><tr><td>0 = helemaal niet</td><td style="text-align:right">10 = zeker wel</td></tr></table>
<p style="margin:0 0 16px">Dank je wel!</p>
<p style="margin:0">Ellen</p>
<hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px">
<p style="margin:0;font-size:12px;color:#777777">ZP Zaken B.V., Tupolevlaan 41, 1119 NW Schiphol-Rijk. Geen vragen zoals deze meer ontvangen? <a href="${esc(p.afmeldUrl)}" style="color:#777777">Afmelden</a>.</p>
</div></body></html>`;
}
