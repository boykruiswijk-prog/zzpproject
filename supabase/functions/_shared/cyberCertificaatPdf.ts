// Tekent het aparte cybercertificaat in dezelfde opmaak als het BAV + AVB-certificaat.
// Puur: geen netwerk, opslag of mail. Nooit throw bij ruimtegebrek.
import { PDFDocument, PDFString, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { COMPANY } from "./company.ts";
import { CERTIFICAAT_FOOTER_ALINEAS, CERTIFICAAT_AFM_URL } from "./certificaatRegels.ts";
import { CYBER_CERTIFICAAT_ONDERTITEL, cyberCertificaatRijen, type CyberCertificaatInvoer } from "./cyberCertificaatTeksten.ts";

const langeDatum = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dagen = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const maanden = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  return `${dagen[dt.getUTCDay()]} ${d} ${maanden[m - 1]} ${y}`;
};

export async function tekenCyberCertificaat(templateBytes: Uint8Array, invoer: CyberCertificaatInvoer) {
  const pdfDoc = await PDFDocument.create();
  const templateImage = await pdfDoc.embedPng(templateBytes);
  const pageWidth = 595.28, pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(templateImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  const wit = rgb(1, 1, 1);
  // Oude voettekst en de BAV-ondertitel/polisregel van het sjabloon afdekken.
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 140, color: wit });
  page.drawRectangle({ x: 40, y: 612, width: 352, height: 72, color: wit });

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0), gray = rgb(0.35, 0.35, 0.35);
  const labelX = 56, valueX = 195, fontSize = 9, smallFontSize = 7.5, lineHeight = 12;
  const maxValueWidth = pageWidth - valueX - 40;

  page.drawText(CYBER_CERTIFICAAT_ONDERTITEL, { x: labelX - 11, y: 662, size: 15, font: helveticaBold, color: gray });

  const wrapText = (text: string, font: typeof helvetica, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = word; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const drawRow = (label: string, value: string, yPos: number, vet = false) => {
    page.drawText(label, { x: labelX, y: yPos, size: fontSize, font: helvetica, color: gray });
    const font = vet ? helveticaBold : helvetica;
    const lines = value.split("\n").flatMap((l) => wrapText(l, font, fontSize, maxValueWidth));
    lines.forEach((line, i) => page.drawText(line, { x: valueX, y: yPos - i * lineHeight, size: fontSize, font, color: black }));
    return (lines.length - 1) * lineHeight;
  };

  let y = 590;
  cyberCertificaatRijen(invoer).forEach((rij, i) => {
    if (i > 0) y -= 17;
    y -= drawRow(rij.label, rij.waarde, y, rij.vet);
  });
  y -= 20;
  drawRow("Afgiftedatum:", langeDatum(invoer.afgiftedatum), y, true);
  y -= 17;
  y -= drawRow("Voor gezien ZP Zaken:", invoer.voor_gezien, y);

  // Voettekst: identiek aan het BAV + AVB-certificaat, flexibele plaatsing, nooit throw.
  const footerWidth = pageWidth - labelX - 40;
  const footerStart = Math.min(119, y - 18);
  let footerFontSize = smallFontSize;
  const measureFooter = (size: number) => {
    const paragraphs = CERTIFICAAT_FOOTER_ALINEAS.map((t) => wrapText(t, helvetica, size, footerWidth));
    const lh = size * 1.4;
    const paragraphGap = size * (4 / smallFontSize);
    const lineCount = paragraphs.reduce((n, l) => n + l.length, 0);
    const bottom = footerStart - (lineCount - 1) * lh - (paragraphs.length - 1) * paragraphGap - size * 0.25;
    return { paragraphs, lineHeight: lh, paragraphGap, bottom };
  };
  let footerLayout = measureFooter(footerFontSize);
  while (footerLayout.bottom < 18 && footerFontSize > 6) {
    footerFontSize = Math.max(6, footerFontSize - 0.25);
    footerLayout = measureFooter(footerFontSize);
  }
  if (footerLayout.bottom < 18) console.warn("Cybercertificaatvoettekst past niet binnen de ondermarge bij 6 punten; PDF wordt toch gemaakt.");
  let footerY = footerStart;
  for (const lines of footerLayout.paragraphs) {
    for (const line of lines) {
      page.drawText(line, { x: labelX, y: footerY, size: footerFontSize, font: helvetica, color: gray });
      const at = line.indexOf(COMPANY.registrations.afm);
      if (at >= 0) {
        const linkX = labelX + helvetica.widthOfTextAtSize(line.slice(0, at), footerFontSize);
        const linkWidth = helvetica.widthOfTextAtSize(COMPANY.registrations.afm, footerFontSize);
        const annotation = pdfDoc.context.register(pdfDoc.context.obj({
          Type: "Annot", Subtype: "Link", Rect: [linkX, footerY - 2, linkX + linkWidth, footerY + footerFontSize],
          Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(CERTIFICAAT_AFM_URL) },
        }));
        page.node.addAnnot(annotation);
        page.drawLine({ start: { x: linkX, y: footerY - 1 }, end: { x: linkX + linkWidth, y: footerY - 1 }, thickness: 0.4, color: gray });
      }
      footerY -= footerLayout.lineHeight;
    }
    footerY -= footerLayout.paragraphGap;
  }
  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, y, footerStart, footerFontSize, footerLayout };
}
