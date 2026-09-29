// Grootboekrekening voor alle BAV-AVB-regels (factuur, creditnota, hervatting,
// maandfactuur). Code staat in exact_config.gl_code_bav (standaard 8003); het
// Exact-ID wordt gecachet in gl_account_id_bav samen met de code waarvoor het geldt.
// Nooit terugvallen op een oude GUID: niet gevonden = harde fout + log + alarm.
// deno-lint-ignore-file no-explicit-any
import { sendExactAlarm } from "./exactAlarm.ts";

export class BavGlError extends Error {}

/** Alleen de cache: voor droogruns zonder token. */
export function cachedBavGlAccountId(cfg: any): string | null {
  const code = String(cfg?.gl_code_bav ?? "8003").trim();
  return cfg?.gl_account_id_bav && String(cfg?.gl_account_id_bav_code ?? "").trim() === code
    ? String(cfg.gl_account_id_bav) : null;
}

export async function getBavGlAccountId(supabase: any, cfg: any, token: string): Promise<string> {
  const code = String(cfg?.gl_code_bav ?? "8003").trim();
  const cached = cachedBavGlAccountId(cfg);
  if (cached) return cached;

  const fout = async (melding: string, http_status?: number): Promise<never> => {
    await supabase.from("exact_sync_log").insert({
      trigger_type: "gl_lookup", status: "error", error_message: melding, http_status: http_status ?? null,
      payload: { gl_code_bav: code },
    }).then(() => {}, () => {});
    await sendExactAlarm(supabase, melding, "exactGl", null).catch(() => "failed");
    throw new BavGlError(melding);
  };

  if (!code) return await fout("Grootboekcode BAV-AVB (exact_config.gl_code_bav) is leeg.");
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`;
  const r = await fetch(
    `${base}/financial/GLAccounts?$select=ID,Code,IsBlocked&$filter=trim(Code) eq '${code.replace(/'/g, "''")}'`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  if (!r.ok) { await r.text().catch(() => ""); return await fout(`Grootboekrekening ${code} opzoeken mislukt (HTTP ${r.status}).`, r.status); }
  const j: any = await r.json().catch(() => ({}));
  const rows: any[] = (j?.d?.results ?? []).filter((x: any) => String(x?.Code ?? "").trim() === code);
  if (rows.length !== 1) return await fout(`Grootboekrekening ${code} niet eenduidig gevonden in Exact (${rows.length} treffers).`);
  if (rows[0].IsBlocked) return await fout(`Grootboekrekening ${code} is geblokkeerd in Exact.`);
  const id = String(rows[0].ID);
  await supabase.from("exact_config").update({ gl_account_id_bav: id, gl_account_id_bav_code: code }).eq("id", cfg.id);
  cfg.gl_account_id_bav = id; cfg.gl_account_id_bav_code = code;
  return id;
}
