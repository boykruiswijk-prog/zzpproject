// PDF van een SEPA-machtiging (pdf-lib, geen externe dienst).
// Standaardfonts gebruiken WinAnsi: niet-ondersteunde tekens worden gestript.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { machtigingTitel, machtigingVelden, type MachtigingData } from "./sepaMachtiging.ts";

export interface PdfOndertekening {
  getoondeTekst: string;
  akkoordOp: string; // ISO
  ipAdres: string | null;
  tekstVersie: string;
  tekstHash: string;
}

// WinAnsi-veilige tekst: vervang typografische tekens, strip de rest.
function winAnsi(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC\n]/g, "");
}

function formatNl(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "long", timeStyle: "medium" }) + " (Europe/Amsterdam)";
}

export async function bouwMachtigingPdf(d: MachtigingData, o: PdfOndertekening): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(winAnsi(`${machtigingTitel(d.type)} ${d.mandaatkenmerk}`));
  pdf.setAuthor(winAnsi(d.incassantNaam));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 56, maxW = W - 2 * M;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const nieuweRegelNodig = (h: number) => {
    if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; }
  };
  const wrap = (text: string, f: typeof font, size: number, width: number): string[] => {
    const out: string[] = [];
    for (const para of winAnsi(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const probe = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(probe, size) > width && line) { out.push(line); line = word; }
        else line = probe;
      }
      out.push(line);
    }
    return out;
  };
  const tekst = (t: string, size = 10, f = font, color = rgb(0.1, 0.1, 0.1), x = M, width = maxW) => {
    for (const l of wrap(t, f, size, width)) {
      nieuweRegelNodig(size + 4);
      page.drawText(l, { x, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  };

  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: rgb(0.898, 0.243, 0.184) });
  tekst(machtigingTitel(d.type), 18, bold);
  y -= 10;

  for (const [label, waarde] of machtigingVelden(d)) {
    const regels = wrap(waarde, font, 10, maxW - 150);
    nieuweRegelNodig(14 * regels.length);
    page.drawText(winAnsi(label), { x: M, y: y - 10, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    regels.forEach((r, i) => page.drawText(r, { x: M + 150, y: y - 10 - i * 14, size: 10, font }));
    y -= 14 * regels.length + 4;
  }

  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;
  tekst("Volledige tekst zoals getoond aan de rekeninghouder:", 10, bold);
  y -= 4;
  tekst(o.getoondeTekst, 9);

  y -= 16;
  nieuweRegelNodig(60);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;
  tekst(
    `Elektronisch ondertekend op ${formatNl(o.akkoordOp)} vanaf IP ${o.ipAdres || "onbekend"}, tekstversie ${o.tekstVersie}, kenmerk ${d.mandaatkenmerk}`,
    9, bold,
  );
  tekst(`SHA-256 van de getoonde tekst: ${o.tekstHash}`, 7, font, rgb(0.4, 0.4, 0.4));

  return await pdf.save();
}
