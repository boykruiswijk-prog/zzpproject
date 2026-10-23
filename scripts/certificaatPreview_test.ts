import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString } from "https://esm.sh/pdf-lib@1.17.1";
import { renderLokaalCertificaat } from "./certificaatPreview.ts";
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