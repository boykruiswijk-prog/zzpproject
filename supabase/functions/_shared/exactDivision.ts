// Read-only controle op de geconfigureerde Exact-administratie.
export type DivisionCheck = {
  ok: boolean;
  status: number;
  division: string;
  administration: string | null;
  error?: string;
};

export async function checkConfiguredDivision(
  baseUrl: string,
  division: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<DivisionCheck> {
  const code = String(division).trim();
  const url = `${baseUrl}/api/v1/${code}/system/Divisions?$select=Code,Description&$filter=Code eq ${encodeURIComponent(code)}`;
  const res = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) {
    return { ok: false, status: res.status, division: code, administration: null, error: `Geen toegang tot administratie ${code}` };
  }
  const body = await res.json().catch(() => ({}));
  const rows = body?.d?.results ?? body?.d ?? [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || String(row.Code ?? "") !== code) {
    return { ok: false, status: 404, division: code, administration: null, error: `Geen toegang tot administratie ${code}` };
  }
  return { ok: true, status: 200, division: code, administration: row.Description ? String(row.Description) : null };
}