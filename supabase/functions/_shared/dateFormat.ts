// Centrale datumformattering voor edge functions (dd-mm-jjjj).
// Spiegelt src/lib/dateFormat.ts.
export function formatDateNL(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Detecteert ISO-datum (YYYY-MM-DD of YYYY-MM-DDTHH:...) en formatteert naar NL.
export function maybeFormatDate(value: unknown): string {
  if (value == null) return "-";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    const f = formatDateNL(s);
    return f || s;
  }
  return s;
}
