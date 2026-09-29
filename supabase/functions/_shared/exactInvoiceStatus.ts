// Pure + read-only Exact invoice-status helpers.
// deno-lint-ignore-file no-explicit-any
export const statusLabel = (status: unknown): "concept" | "verwerkt" | "onbekend" =>
  Number(status) === 20 ? "concept" : Number(status) === 50 ? "verwerkt" : "onbekend";

export function batches<T>(waarden: T[], size = 20): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < waarden.length; i += size) result.push(waarden.slice(i, i + size));
  return result;
}

export async function readInvoiceStatuses(baseUrl: string, division: string, token: string, ids: string[]) {
  const uniek = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  const rows: any[] = [];
  for (const groep of batches(uniek, 20)) {
    if (!groep.length) continue;
    const filter = groep.map((id) => `InvoiceID eq guid'${id}'`).join(" or ");
    const url = `${baseUrl}/api/v1/${division}/salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,Status,YourRef&$filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Factuurstatus ophalen mislukt (HTTP ${res.status}).`);
    const body = await res.json().catch(() => ({}));
    rows.push(...(body?.d?.results ?? body?.d ?? []));
  }
  return rows;
}

export async function readLatestInvoiceStatus(baseUrl: string, division: string, token: string, accountId: string) {
  const filter = `InvoiceTo eq guid'${accountId}'`;
  const url = `${baseUrl}/api/v1/${division}/salesinvoice/SalesInvoices?$select=InvoiceID,InvoiceNumber,Status,YourRef&$filter=${encodeURIComponent(filter)}&$orderby=InvoiceDate desc&$top=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Laatste factuurstatus ophalen mislukt (HTTP ${res.status}).`);
  const body = await res.json().catch(() => ({}));
  return (body?.d?.results ?? body?.d ?? [])[0] ?? null;
}