// Local-only: run the exact production PDF drawing block, never the HTTP handler.
import ts from "npm:typescript@5.8.3";
import { PDFDocument, PDFString, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { COMPANY } from "../supabase/functions/_shared/company.ts";
import { EIGEN_RISICO_TEKST, POLISBLAD_NOTITIE, CERTIFICAAT_FOOTER_ALINEAS, CERTIFICAAT_AFM_URL } from "../supabase/functions/_shared/certificaatRegels.ts";

export async function renderLokaalCertificaat(heeftNieuweCyber = false) {
  const source = await Deno.readTextFile(new URL("../supabase/functions/generate-certificate/index.ts", import.meta.url));
  const start = source.indexOf("    // === Create PDF with template as background ===");
  const end = source.indexOf("    const fileName =", start);
  if (start < 0 || end < 0) throw new Error("PDF drawing block not found");
  const code = ts.transpileModule(source.slice(start, end) + "\nreturn { pdfBytes, y, footerY };", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const templateBytes = await Deno.readFile(new URL("../public/templates/certificate-template.png", import.meta.url));
  const policy = {
    certificate_holder: "Fictief Voorbeeld B.V.", insured_name: "Test Voorbeeld",
    certificate_number: "TEST-BAV-2310", start_date: "2026-10-24", issued_date: "2026-10-23",
    profession: "IT & ICT", issued_by: "Testmedewerker", bav_per_event: "€ 5.000.000",
    bav_per_year: "€ 15.000.000", avb_per_event: "€ 2.500.000", avb_per_year: "€ 5.000.000",
  };
  const dependencies = { PDFDocument, PDFString, rgb, StandardFonts, COMPANY, EIGEN_RISICO_TEKST,
    POLISBLAD_NOTITIE, CERTIFICAAT_FOOTER_ALINEAS, CERTIFICAAT_AFM_URL, templateBytes, policy,
    kvkNummerBron: "12345678", heeftNieuweCyber };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  // No network, storage, customer records or mail are present in this isolated block.
  return await new AsyncFunction(...Object.keys(dependencies), code)(...Object.values(dependencies));
}

if (import.meta.main) {
  const output = Deno.args[0];
  if (!output) throw new Error("Provide a local output PDF path");
  const { pdfBytes, y, footerY } = await renderLokaalCertificaat(Deno.args.includes("--cyber"));
  const pdf = await PDFDocument.load(pdfBytes);
  await Deno.writeFile(output, pdfBytes);
  console.log(JSON.stringify({ pages: pdf.getPageCount(), contentBottom: y, footerBottom: footerY, output }));
}