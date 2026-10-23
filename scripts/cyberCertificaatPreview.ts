// Local-only: render the cyber certificate with fictitious data and the local template.
import { tekenCyberCertificaat } from "../supabase/functions/_shared/cyberCertificaatPdf.ts";
import type { CyberCertificaatInvoer } from "../supabase/functions/_shared/cyberCertificaatTeksten.ts";

export const FICTIEF_CYBER: CyberCertificaatInvoer = {
  certificaathouder: "Fictief Voorbeeld B.V.", kvk: "12345678", verzekeringsnemer: "Test Voorbeeld",
  bav_certificaatnummer: "ZPBAV5193", cyber_ingangsdatum: "2026-10-24", afgiftedatum: "2026-10-23", voor_gezien: "Testmedewerker",
};
export const LANG_CYBER: CyberCertificaatInvoer = {
  ...FICTIEF_CYBER,
  certificaathouder: "Fictieve Internationale Organisatie voor Digitale Transformatie en Bedrijfsvoering B.V.",
  verzekeringsnemer: "Alexandra Wilhelmina van der Heijden-Vermeulen de Boer",
};

export async function renderLokaalCyber(invoer: CyberCertificaatInvoer = FICTIEF_CYBER) {
  const tpl = await Deno.readFile(new URL("../public/templates/certificate-template.png", import.meta.url));
  return await tekenCyberCertificaat(tpl, invoer);
}

if (import.meta.main) {
  const out = Deno.args[0];
  if (!out) throw new Error("Provide output path");
  const r = await renderLokaalCyber(Deno.args.includes("--lang") ? LANG_CYBER : FICTIEF_CYBER);
  await Deno.writeFile(out, r.pdfBytes);
  console.log(JSON.stringify({ y: r.y, footerStart: r.footerStart, footerFontSize: r.footerFontSize, bottom: r.footerLayout.bottom }));
}
