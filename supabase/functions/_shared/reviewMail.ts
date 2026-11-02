// Teksten en opmaak van het reviewverzoek aan nieuwe klanten. Pure helper.
// Geen beloning, geen filter op tevredenheid: iedere nieuwe klant krijgt hetzelfde verzoek.

export const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJ5wXTzBPnxUcR5NGNhaq2lJA";

export type ReviewSoort = "review_verzoek" | "review_herinnering" | "review_verzoek_bestaand";

// Logo: https://zpzaken.nl/logo.png (PNG 150x168, 6 kB, rood merkteken leesbaar op wit).
export const REVIEW_LOGO_URL = "https://zpzaken.nl/logo.png";
const LOGO_KOP = `<img src="${REVIEW_LOGO_URL}" alt="ZP Zaken" height="40" style="display:block;border:0;height:40px;width:auto">`;
const LOGO_GROET = `<img src="${REVIEW_LOGO_URL}" alt="ZP Zaken" height="24" style="display:block;border:0;height:24px;width:auto;margin-top:8px">`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function reviewOnderwerp(soort: ReviewSoort, voornaam?: string | null): string {
  const naam = (voornaam ?? "").trim();
  if (soort === "review_verzoek_bestaand") return "Zou ik je om een kleine gunst mogen vragen?";
  return soort === "review_verzoek"
    ? (naam ? `${naam}, mag ik je iets vragen?` : "Mag ik je iets vragen?")
    : "Nog één keer, daarna laat ik je met rust";
}

export function reviewHtml(p: { soort: ReviewSoort; voornaam?: string | null; klikUrl: string; afmeldUrl: string }): string {
  const naam = (p.voornaam ?? "").trim();
  const aanhef = naam ? `Hoi ${esc(naam)},` : "Hoi,";
  const alinea = p.soort === "review_verzoek_bestaand"
    ? `Je hebt dit jaar je BAV en AVB bij ZP Zaken geregeld. Fijn dat je voor ons gekozen hebt.</p>
<p style="margin:0 0 24px">Reviews zijn voor ons enorm belangrijk. Ze zijn ons uithangbord naar andere zzp'ers die op zoek zijn naar een goede BAV, en jouw ervaring helpt hen bij hun keuze. Wil je een korte review op Google achterlaten? Twee zinnen is genoeg, het kost je een minuut.`
    : p.soort === "review_verzoek"
    ? `Ik ben Ellen. Ik heb jouw aanvraag beoordeeld en je BAV en AVB geregeld. Je certificaat heb je inmiddels binnen.</p>
<p style="margin:0 0 24px">Mag ik je om een kleine gunst vragen? Een korte review op Google helpt andere zzp'ers die net als jij snel een BAV nodig hebben. Twee zinnen is genoeg, het kost je een minuut.`
    : "Vorige week vroeg ik of je wilt laten weten hoe het regelen van je BAV en AVB ging. Geen tijd gehad? Snap ik helemaal. Het kost echt maar een minuut en het helpt andere zzp'ers bij hun keuze.";
  const naKnop = p.soort === "review_verzoek_bestaand"
    ? `<p style="margin:0 0 16px">Kan er iets beter? Antwoord dan op deze mail, dan pak ik het persoonlijk op.</p>`
    : p.soort === "review_verzoek"
    ? `<p style="margin:0 0 16px">Ging er iets niet goed? Antwoord dan op deze mail, dan los ik het persoonlijk op.</p>`
    : `<p style="margin:0 0 16px">Dit is de laatste keer dat ik erom vraag.</p>`;
  const groet = p.soort === "review_herinnering" ? `Ellen${LOGO_GROET}` : `Ellen Baars<br>ZP Zaken | 020 457 3077${LOGO_GROET}`;
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-size:15px;line-height:1.6">
<p style="margin:0 0 24px">${LOGO_KOP}</p>
<p style="margin:0 0 16px">${aanhef}</p>
<p style="margin:0 0 24px">${alinea}</p>
<p style="margin:0 0 24px"><a href="${esc(p.klikUrl)}" style="display:inline-block;background:#E53E2F;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Schrijf je review op Google</a></p>
${naKnop}<p style="margin:0">Groet,<br>${groet}</p>
<hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px">
<p style="margin:0;font-size:12px;color:#777777">ZP Zaken B.V., Tupolevlaan 41, 1119 NW Schiphol-Rijk. Geen reviewverzoeken meer ontvangen? <a href="${esc(p.afmeldUrl)}" style="color:#777777">Afmelden</a>.</p>
</div></body></html>`;
}
