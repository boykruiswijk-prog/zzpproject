// Alleen-lezen: PDF van een verwerkte verkoopfactuur uit Exact.
// Route (getest): documents/Documents (SalesInvoiceNumber) → DocumentAttachments → .pdf → Url + "&Download=1".
// docs/XMLDownload.aspx geeft in deze administratie HTTP 400 en wordt niet meer gebruikt.
// deno-lint-ignore-file no-explicit-any
const lijst = (j: any): any[] => j?.d?.results ?? (Array.isArray(j?.d) ? j.d : []);

export async function haalFactuurPdf(
  baseUrl: string, div: string, token: string, factuurnummer: string | number,
): Promise<{ ok: true; bytes: Uint8Array; bestandsnaam: string } | { ok: false; reden: string; http?: number }> {
  const nr = String(factuurnummer).replace(/\D/g, "");
  if (!nr) return { ok: false, reden: "geen_factuurnummer" };
  const h = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const d = await fetch(`${baseUrl}/api/v1/${div}/documents/Documents?$select=ID,Type&$filter=${encodeURIComponent(`SalesInvoiceNumber eq ${nr} and Type eq 10`)}&$top=1`, { headers: h });
  if (!d.ok) return { ok: false, reden: "documents", http: d.status };
  const doc = lijst(await d.json().catch(() => null))[0];
  if (!doc?.ID) return { ok: false, reden: "geen_document" };
  const a = await fetch(`${baseUrl}/api/v1/${div}/documents/DocumentAttachments?$select=ID,FileName,Url&$filter=${encodeURIComponent(`Document eq guid'${doc.ID}'`)}`, { headers: h });
  if (!a.ok) return { ok: false, reden: "attachments", http: a.status };
  const pdf = lijst(await a.json().catch(() => null)).find((x) => /\.pdf$/i.test(String(x.FileName ?? "")));
  if (!pdf?.Url) return { ok: false, reden: "geen_pdf_bijlage" };
  const f = await fetch(`${pdf.Url}&Download=1`, { headers: { Authorization: `Bearer ${token}`, Accept: "*/*" } });
  if (!f.ok) return { ok: false, reden: "download", http: f.status };
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return { ok: false, reden: "geen_pdf_inhoud" };
  return { ok: true, bytes, bestandsnaam: String(pdf.FileName) };
}
