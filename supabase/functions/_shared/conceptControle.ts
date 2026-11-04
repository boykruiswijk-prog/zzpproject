/** Bewust vervallen is geen verwijderd of verwerkt Exact-concept. Bewaar het ID. */
export function conceptMoetGecontroleerdWorden(r: { exact_invoice_status?: number | null; exact_invoice_verwijderd_op?: string | null; exact_invoice_vervallen_op?: string | null }): boolean {
  return Number(r.exact_invoice_status ?? 0) !== 50 && !r.exact_invoice_verwijderd_op && !r.exact_invoice_vervallen_op;
}