// K5 — dagelijkse keepalive: forceert een token-refresh zodat het refresh token
// nooit stil verloopt, en controleert daarna /current/Me + divisie.
// Toegang: alleen header x-cron-secret (verify_cron_secret).
// Testparameter ?test_alarm=1: bouwt alleen de alarmmail en draait de
// 24-uurscheck; geen refresh, geen Exact-aanroep, geen mail.
import { createClient } from "npm:@supabase/supabase-js@2";
import { refreshAccessToken } from "../_shared/exactToken.ts";
import { alarmRecentlySent, buildAlarmMail, sanitizeError, sendExactAlarm } from "../_shared/exactAlarm.ts";
import { readInvoiceStatuses } from "../_shared/exactInvoiceStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!secret) return json({ error: "unauthorized" }, 401);
  const { data: ok } = await supabase.rpc("verify_cron_secret", { p_secret: secret });
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  if (url.searchParams.get("test_alarm") === "1") {
    const mail = buildAlarmMail("Testmelding: refresh mislukt (401)", "exact-keepalive", true);
    return json({ test: true, sent: false, would_throttle: await alarmRecentlySent(supabase), mail });
  }

  const { data: cfg } = await supabase.from("exact_config").select("*").limit(1).maybeSingle();

  const fail = async (melding: string, http_status?: number) => {
    const m = sanitizeError(melding);
    if (cfg?.id) await supabase.from("exact_config").update({ last_error: m }).eq("id", cfg.id);
    await supabase.from("exact_sync_log").insert({
      trigger_type: "keepalive", status: "error", error_message: m, http_status: http_status ?? null,
    });
    const alarm = await sendExactAlarm(supabase, m, "exact-keepalive", null);
    return json({ ok: false, error: m, alarm }, 502);
  };

  if (!cfg) return await fail("Geen Exact-configuratie gevonden.");
  if (!cfg.is_actief) return await fail("Exact-koppeling staat niet actief.");

  let token: string;
  try {
    token = await refreshAccessToken(supabase, cfg, true); // geforceerd, incl. 401-herlees
  } catch (e) {
    return await fail(`Token vernieuwen mislukt: ${e instanceof Error ? e.message : String(e)}`);
  }

  const baseUrl = cfg.base_url || "https://start.exactonline.nl";
  const r = await fetch(`${baseUrl}/api/v1/current/Me?$select=CurrentDivision`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) { await r.text().catch(() => ""); return await fail(`Controle-aanroep /Me mislukt (HTTP ${r.status}).`, r.status); }
  // deno-lint-ignore no-explicit-any
  const body: any = await r.json().catch(() => ({}));
  const current = String(body?.d?.results?.[0]?.CurrentDivision ?? body?.d?.CurrentDivision ?? "");
  const expected = String(cfg.divisie_code ?? "");
  if (!current || current !== expected) {
    return await fail(`Verkeerde administratie gekoppeld: Exact geeft divisie ${current || "onbekend"}, verwacht ${expected || "onbekend"}.`, r.status);
  }

  const now = new Date().toISOString();
  let statusesUpdated = 0;
  const { data: leads } = await supabase.from("leads").select("id,exact_invoice_id").not("exact_invoice_id", "is", null).limit(500);
  try {
    const rows = await readInvoiceStatuses(baseUrl, current, token, (leads ?? []).map((l: { exact_invoice_id: string | null }) => l.exact_invoice_id ?? ""));
    const perId = new Map(rows.map((row) => [String(row.InvoiceID).toLowerCase(), Number(row.Status)]));
    for (const lead of (leads ?? []) as Array<{ id: string; exact_invoice_id: string }>) {
      const status = perId.get(String(lead.exact_invoice_id).toLowerCase());
      if (Number.isFinite(status)) {
        await supabase.from("leads").update({ exact_invoice_status: status }).eq("id", lead.id);
        statusesUpdated += 1;
      }
    }
  } catch (e) {
    await supabase.from("exact_sync_log").insert({ trigger_type: "invoice_status_sync", status: "error", error_message: sanitizeError(e instanceof Error ? e.message : String(e)) });
  }
  await supabase.from("exact_config").update({ last_error: null, last_sync_at: now }).eq("id", cfg.id);
  await supabase.from("exact_sync_log").insert({
    trigger_type: "keepalive", status: "success", http_status: 200, payload: { division: current, invoice_statuses_updated: statusesUpdated },
  });
  return json({ ok: true, division: current, at: now, invoice_statuses_updated: statusesUpdated });
});
