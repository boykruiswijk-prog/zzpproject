// Normaliseert Exact-/AFAS-relatiecodes: trim (Exact vult rechts uitgelijnd met spaties aan),
// hoofdletters, numerieke codes zonder voorloopnullen. Zelfde regel als SQL public.exact_code_norm.
export function exactCodeNorm(code: unknown): string | null {
  const s = String(code ?? "").trim();
  if (!s) return null;
  if (/^[0-9]+$/.test(s)) return s.replace(/^0+/, "") || "0";
  return s.toUpperCase();
}

/** Exact OData-datum ("/Date(1760572800000)/" of ISO) → "YYYY-MM-DD" (UTC), anders null. */
export function exactDatum(v: unknown): string | null {
  if (v == null || v === "") return null;
  const m = /\/Date\((-?\d+)\)\//.exec(String(v));
  const d = m ? new Date(Number(m[1])) : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
