// Gedeelde mailkop voor alle uitgaande mail: ZP Zaken-logo bovenaan, gelijk aan de reviewmail.
// Inhoud en teksten van de mail blijven ongewijzigd; alleen de kop wordt toegevoegd.
// Idempotent: bevat de html het logo al (zoals de reviewmail), dan verandert er niets.

export const MAIL_LOGO_URL = "https://zpzaken.nl/logo.png";
export const MAIL_LOGO_ALT = "ZP Zaken";
export const MAIL_LOGO_HOOGTE = 40;

export const MAIL_KOP =
  `<div style="padding:0 0 16px 0"><img src="${MAIL_LOGO_URL}" alt="${MAIL_LOGO_ALT}" height="${MAIL_LOGO_HOOGTE}" style="display:block;border:0;height:${MAIL_LOGO_HOOGTE}px;width:auto"></div>`;

export function bevatLogo(html: string): boolean {
  return html.includes(MAIL_LOGO_URL);
}

export function metMailKop(html: string): string {
  if (!html || bevatLogo(html)) return html;
  const body = html.match(/<body[^>]*>/i);
  if (body && body.index !== undefined) {
    const eind = body.index + body[0].length;
    return html.slice(0, eind) + MAIL_KOP + html.slice(eind);
  }
  return MAIL_KOP + html;
}
