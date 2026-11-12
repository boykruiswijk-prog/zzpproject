// Deliberately narrow write allowlist, shared by invoices and credit notes.
// Exact REST SalesInvoice / SalesInvoiceLine: only fields used and verified here.
export const SALES_INVOICE_VELDEN = ["InvoiceTo", "OrderedBy", "Journal", "PaymentCondition", "Type", "Status", "InvoiceDate", "OrderDate", "YourRef", "Remarks", "Description", "SalesInvoiceLines"] as const;
export const SALES_INVOICE_LINE_VELDEN = ["Item", "Quantity", "UnitPrice", "VATCode", "Description", "StartTime", "EndTime", "GLAccount", "Notes"] as const;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function controleer(value: Record<string, unknown>, velden: readonly string[], soort: string): void {
  for (const veld of Object.keys(value)) {
    if (!velden.includes(veld)) throw new Error(`Exact ${soort}: niet toegestaan veld ${veld}`);
  }
}
export function controleerExactFactuurPayload(payload: unknown): void {
  if (!object(payload)) throw new Error("Exact SalesInvoice: object vereist");
  controleer(payload, SALES_INVOICE_VELDEN, "SalesInvoice");
  if (payload.Type !== 8020 && payload.Type !== 8021) throw new Error("Exact SalesInvoice: ongeldig type");
  if (!Array.isArray(payload.SalesInvoiceLines)) throw new Error("Exact SalesInvoiceLines: lijst vereist");
  for (const regel of payload.SalesInvoiceLines) {
    if (!object(regel)) throw new Error("Exact SalesInvoiceLine: object vereist");
    controleer(regel, SALES_INVOICE_LINE_VELDEN, "SalesInvoiceLine");
  }
}