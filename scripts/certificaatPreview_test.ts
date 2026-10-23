import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString } from "https://esm.sh/pdf-lib@1.17.1";
import { renderLokaalCertificaat, LANG_CERTIFICAAT } from "./certificaatPreview.ts";
import { CERTIFICAAT_AFM_URL } from "../supabase/functions/_shared/certificaatRegels.ts";

Deno.test("fictief BAV AVB en cybercertificaat: één pagina en werkende AFM-link", async () => {
  for (const cyber of [false, true]) {
    const { pdfBytes } = await renderLokaalCertificaat(cyber);
    const pdf = await PDFDocument.load(pdfBytes);
    if (pdf.getPageCount() !== 1) throw new Error("Certificate must have exactly one page");
    const page = pdf.getPage(0);
    const annotations = page.node.lookup(PDFName.of("Annots"), PDFArray);
    const link = annotations.lookup(0, PDFDict).lookup(PDFName.of("A"), PDFDict);
    const uri = link.lookup(PDFName.of("URI"), PDFString).decodeText();
    if (uri !== CERTIFICAAT_AFM_URL) throw new Error("AFM link does not match the approved URL");
  }
});

Deno.test("langste realistische cybercertificaat: geen fout, één pagina zonder overlap", async () => {
  const result = await renderLokaalCertificaat(true, LANG_CERTIFICAAT);
  const pdf = await PDFDocument.load(result.pdfBytes);
  if (pdf.getPageCount() !== 1) throw new Error("Expected one page");
  if (result.footerStart !== Math.min(119, result.y - 18)) throw new Error("Footer must follow content");
  if (result.footerStart + result.footerFontSize >= result.y - 2) throw new Error("Footer overlaps content");
  if (result.footerLayout.bottom < 18) throw new Error("Footer outside bottom margin");
  if (result.footerFontSize < 6 || result.footerFontSize > 7.5) throw new Error("Font size outside safe range");
});

Deno.test("lagere inhoud verkleint footer stapsgewijs en behoudt ondermarge", async () => {
  const result = await renderLokaalCertificaat(true, { ...LANG_CERTIFICAAT, profession: LANG_CERTIFICAAT.profession.repeat(3) });
  if (result.footerFontSize < 6 || result.footerFontSize >= 7.5) throw new Error("Expected incremental shrink");
  if (result.footerLayout.bottom < 18) throw new Error("Expected safe bottom margin after shrink");
  if (result.footerStart + result.footerFontSize >= result.y - 2) throw new Error("Footer overlaps content");
});

Deno.test("ruimtegebrek zelfs bij 6 punten: waarschuwing maar PDF zonder fout", async () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => { warnings.push(message); };
  try {
    const result = await renderLokaalCertificaat(true, { ...LANG_CERTIFICAAT, profession: LANG_CERTIFICAAT.profession.repeat(5) });
    if (result.footerFontSize !== 6) throw new Error("Minimum font size must be 6");
    if (warnings.length !== 1) throw new Error("Expected exactly one warning");
    if ((await PDFDocument.load(result.pdfBytes)).getPageCount() !== 1) throw new Error("Expected a PDF, not a failure");
  } finally { console.warn = original; }
});