// Teksten en opmaak van het reviewverzoek aan nieuwe klanten. Pure helper.
// Geen beloning, geen filter op tevredenheid: iedere nieuwe klant krijgt hetzelfde verzoek.

export const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJ5wXTzBPnxUcR5NGNhaq2lJA";

export type ReviewSoort = "review_verzoek" | "review_herinnering";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function reviewOnderwerp(soort: ReviewSoort): string {
  return soort === "review_verzoek"
    ? "Je BAV en AVB zijn geregeld, hoe was het?"
    : "Nog even over je ervaring met ZP Zaken";
}

export function reviewHtml(p: { soort: ReviewSoort; voornaam?: string | null; klikUrl: string; afmeldUrl: string }): string {
  const naam = (p.voornaam ?? "").trim();
  const aanhef = naam ? `Hoi ${esc(naam)},` : "Hoi,";
  const alinea = p.soort === "review_verzoek"
    ? "Je verzekering loopt en je certificaat staat in je mailbox. Wil je in een minuut laten weten hoe het ging? Daarmee help je andere zzp'ers bij hun keuze."
    : "Vorige week vroegen we hoe je afsluiting bij ZP Zaken ging. Heb je een minuut? Je review helpt andere zzp'ers echt verder.";
  const naKnop = p.soort === "review_verzoek"
    ? `<p style="margin:0 0 16px">Was er iets niet goed? Antwoord dan gewoon op deze mail, dan lossen we het op.</p>`
    : "";
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-size:15px;line-height:1.6">
<p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken</p>
<p style="margin:0 0 16px">${aanhef}</p>
<p style="margin:0 0 24px">${alinea}</p>
<p style="margin:0 0 24px"><a href="${esc(p.klikUrl)}" style="display:inline-block;background:#E53E2F;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Review schrijven op Google</a></p>
${naKnop}<p style="margin:0">Groet,<br>Ellen van ZP Zaken</p>
<hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px">
<p style="margin:0;font-size:12px;color:#777777">ZP Zaken B.V., Tupolevlaan 41, 1119 NW Schiphol-Rijk. Geen reviewverzoeken meer ontvangen? <a href="${esc(p.afmeldUrl)}" style="color:#777777">Afmelden</a>.</p>
</div></body></html>`;
}
