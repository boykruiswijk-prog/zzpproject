// K5 — dagelijkse keepalive: forceert een token-refresh zodat het refresh token
// nooit stil verloopt, en controleert daarna rechtstreeks de ingestelde divisie.
// Toegang: alleen header x-cron-secret (verify_cron_secret).
// Testparameter ?test_alarm=1: bouwt alleen de alarmmail en draait de
// 24-uurscheck; geen refresh, geen Exact-aanroep, geen mail.
import { createClient } from "npm:@supabase/supabase-js@2";
import { refreshAccessToken } from "../_shared/exactToken.ts";
import { alarmRecentlySent, buildAlarmMail, sanitizeError, sendExactAlarm } from "../_shared/exactAlarm.ts";
import { readInvoiceStatuses } from "../_shared/exactInvoiceStatus.ts";
import { checkConfiguredDivision } from "../_shared/exactDivision.ts";

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
    return json({ test: true, sent: false, would_throttle: await alarmRecentlySent(supabase, "Testmelding: refresh mislukt (401)"), mail });
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
  const meRes = await fetch(`${baseUrl}/api/v1/current/Me?$select=CurrentDivision`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const meBody: any = meRes.ok ? await meRes.json().catch(() => ({})) : {};
  const currentDivision = String(meBody?.d?.results?.[0]?.CurrentDivision ?? meBody?.d?.CurrentDivision ?? "") || null;
  const configuredDivision = String(cfg.divisie_code ?? "");
  if (!configuredDivision) return await fail("Geen geconfigureerde Exact-administratie.");
  const divisionCheck = await checkConfiguredDivision(baseUrl, configuredDivision, token);
  if (!divisionCheck.ok) return await fail(divisionCheck.error ?? `Geen toegang tot administratie ${configuredDivision}`, divisionCheck.status);

  const now = new Date().toISOString();
  let statusesUpdated = 0;
  const { data: leads } = await supabase.from("leads").select("id,exact_invoice_id").not("exact_invoice_id", "is", null).limit(500);
  try {
    const rows = await readInvoiceStatuses(baseUrl, configuredDivision, token, (leads ?? []).map((l: { exact_invoice_id: string | null }) => l.exact_invoice_id ?? ""));
    const perId = new Map(rows.map((row) => [String(row.InvoiceID).toLowerCase(), row]));
    for (const lead of (leads ?? []) as Array<{ id: string; exact_invoice_id: string }>) {
      const row = perId.get(String(lead.exact_invoice_id).toLowerCase());
      const status = Number(row?.Status);
      if (row && Number.isFinite(status)) {
        // Alleen lezen uit Exact; factuurnummer pas overnemen als Exact er een heeft gegeven.
        const nummer = row.InvoiceNumber != null && String(row.InvoiceNumber).trim() !== "" && status === 50 ? String(row.InvoiceNumber) : null;
        await supabase.from("leads").update(nummer ? { exact_invoice_status: status, exact_invoice_number: nummer } : { exact_invoice_status: status }).eq("id", lead.id);
        statusesUpdated += 1;
      }
    }
  } catch (e) {
    await supabase.from("exact_sync_log").insert({ trigger_type: "invoice_status_sync", status: "error", error_message: sanitizeError(e instanceof Error ? e.message : String(e)) });
  }
  await supabase.from("exact_config").update({ last_error: null, last_sync_at: now }).eq("id", cfg.id);
  await supabase.from("exact_sync_log").insert({
    trigger_type: "keepalive", status: "success", http_status: 200,
    payload: { division: configuredDivision, administration: divisionCheck.administration, current_division_info: currentDivision, invoice_statuses_updated: statusesUpdated },
  });
  return json({ ok: true, division: configuredDivision, administration: divisionCheck.administration, current_division_info: currentDivision, at: now, invoice_statuses_updated: statusesUpdated });
});
