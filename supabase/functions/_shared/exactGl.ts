// Grootboekrekening voor alle BAV-AVB-regels (factuur, creditnota, hervatting,
// maandfactuur). Code staat in exact_config.gl_code_bav (standaard 8003); het
// Exact-ID wordt gecachet in gl_account_id_bav samen met de code waarvoor het geldt.
// Nooit terugvallen op een oude GUID: niet gevonden = harde fout + log + alarm.
// deno-lint-ignore-file no-explicit-any
import { sendExactAlarm } from "./exactAlarm.ts";

export class BavGlError extends Error {}

/** Alleen de cache: voor droogruns zonder token. */
export function cachedGlAccountId(cfg: any, kolomCode: string, kolomCache: string, standaard = ""): string | null {
  const code = String(cfg?.[kolomCode] ?? standaard).trim();
  return code && cfg?.[kolomCache] && String(cfg?.[`${kolomCache}_code`] ?? "").trim() === code
    ? String(cfg[kolomCache]) : null;
}

export function cachedBavGlAccountId(cfg: any): string | null {
  return cachedGlAccountId(cfg, "gl_code_bav", "gl_account_id_bav", "8003");
}

/**
 * Generiek: zoekt de grootboekrekening op code (exact_config[kolomCode]) en cachet
 * het ID in exact_config[kolomCache] + exact_config[kolomCache + "_code"].
 */
export async function getGlAccountIdByCode(
  supabase: any, cfg: any, token: string, kolomCode: string, kolomCache: string, standaard = "",
): Promise<string> {
  const code = String(cfg?.[kolomCode] ?? standaard).trim();
  const cached = cachedGlAccountId(cfg, kolomCode, kolomCache, standaard);
  if (cached) return cached;

  const fout = async (melding: string, http_status?: number): Promise<never> => {
    await supabase.from("exact_sync_log").insert({
      trigger_type: "gl_lookup", status: "error", error_message: melding, http_status: http_status ?? null,
      payload: { [kolomCode]: code },
    }).then(() => {}, () => {});
    await sendExactAlarm(supabase, melding, "exactGl", null).catch(() => "failed");
    throw new BavGlError(melding);
  };

  if (!code) return await fout(`Grootboekcode (exact_config.${kolomCode}) is leeg.`);
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
  await supabase.from("exact_config").update({ [kolomCache]: id, [`${kolomCache}_code`]: code }).eq("id", cfg.id);
  cfg[kolomCache] = id; cfg[`${kolomCache}_code`] = code;
  return id;
}

/** Grootboek ontbreekt in Exact: blokkeert alleen de betreffende regel. */
export class GlNietGevondenError extends Error {}

/**
 * Elke grootboekcode (8003, 8004, ...): alleen GET op financial/GLAccounts, cache in
 * exact_config.gl_account_ids (jsonb code → ID). BAV-code gebruikt de bestaande cache.
 */
export async function getGlAccountIdVoorCode(supabase: any, cfg: any, token: string, code: string): Promise<string> {
  const c = String(code ?? "").trim();
  if (c === String(cfg?.gl_code_bav ?? "8003").trim()) return await getBavGlAccountId(supabase, cfg, token);
  const cached = cfg?.gl_account_ids?.[c];
  if (cached) return String(cached);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${cfg.divisie_code}`;
  const r = await fetch(`${base}/financial/GLAccounts?$select=ID,Code,IsBlocked&$filter=${encodeURIComponent(`trim(Code) eq '${c.replace(/'/g, "''")}'`)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!r.ok) { await r.text().catch(() => ""); throw new BavGlError(`grootboek ${c} opzoeken mislukt (HTTP ${r.status})`); }
  const j: any = await r.json().catch(() => ({}));
  const rows: any[] = (j?.d?.results ?? []).filter((x: any) => String(x?.Code ?? "").trim() === c);
  if (rows.length === 0) throw new GlNietGevondenError(`grootboek ${c} niet gevonden in Exact`);
  if (rows.length > 1) throw new GlNietGevondenError(`grootboek ${c} niet eenduidig in Exact (${rows.length} treffers)`);
  if (rows[0].IsBlocked) throw new GlNietGevondenError(`grootboek ${c} is geblokkeerd in Exact`);
  const id = String(rows[0].ID);
  const nieuw = { ...(cfg.gl_account_ids ?? {}), [c]: id };
  await supabase.from("exact_config").update({ gl_account_ids: nieuw }).eq("id", cfg.id);
  cfg.gl_account_ids = nieuw;
  return id;
}

/** BAV-AVB (standaard 8003). */
export async function getBavGlAccountId(supabase: any, cfg: any, token: string): Promise<string> {
  return await getGlAccountIdByCode(supabase, cfg, token, "gl_code_bav", "gl_account_id_bav", "8003");
}
