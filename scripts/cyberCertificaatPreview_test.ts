import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString } from "https://esm.sh/pdf-lib@1.17.1";
import { renderLokaalCyber, LANG_CYBER } from "./cyberCertificaatPreview.ts";
import { CERTIFICAAT_AFM_URL } from "../supabase/functions/_shared/certificaatRegels.ts";

Deno.test("cybercertificaat: één pagina, AFM-link, geen overlap", async () => {
  for (const invoer of [undefined, LANG_CYBER]) {
    const r = await renderLokaalCyber(invoer);
    const pdf = await PDFDocument.load(r.pdfBytes);
    if (pdf.getPageCount() !== 1) throw new Error("Expected one page");
    const link = pdf.getPage(0).node.lookup(PDFName.of("Annots"), PDFArray).lookup(0, PDFDict).lookup(PDFName.of("A"), PDFDict);
    if (link.lookup(PDFName.of("URI"), PDFString).decodeText() !== CERTIFICAAT_AFM_URL) throw new Error("AFM link");
    if (r.footerStart + r.footerFontSize >= r.y - 2) throw new Error("Footer overlaps content");
    if (r.footerLayout.bottom < 18) throw new Error("Footer outside bottom margin");
  }
});

Deno.test("cybercertificaat bij extreem lange tekst: waarschuwing, nooit fout", async () => {
  const orig = console.warn; const w: string[] = []; console.warn = (m: string) => { w.push(m); };
  try {
    const r = await renderLokaalCyber({ ...LANG_CYBER, verzekeringsnemer: LANG_CYBER.verzekeringsnemer.repeat(12) });
    if ((await PDFDocument.load(r.pdfBytes)).getPageCount() !== 1) throw new Error("Expected PDF");
    if (r.footerFontSize < 6) throw new Error("Below 6pt");
  } finally { console.warn = orig; }
});
