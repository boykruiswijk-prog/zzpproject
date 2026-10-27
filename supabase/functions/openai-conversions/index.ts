import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { z } from "npm:zod@3.25.76";
import { isInternalMachine } from "../_shared/teamAuth.ts";
import { maakOpenaiLeadEvent, OPENAI_ADS_ENDPOINT } from "../_shared/openaiAdsEvent.ts";

const bodySchema = z.union([
  z.object({ aanvraag_id: z.string().uuid(), validate_only: z.literal(false).optional() }).strict(),
  z.object({ validate_only: z.literal(true) }).strict(),
]);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response({ ok: true });
  if (!isInternalMachine(req)) return response({ error: "unauthorized" }, 401);
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return response({ error: "invalid_input" }, 400);
  const key = Deno.env.get("OPENAI_ADS_CAPI_KEY");
  if (!key) return response({ error: "key_not_configured" }, 503);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const validateOnly = parsed.data.validate_only === true;
  let aanvraagId: string | null = null;
  let event;
  if (validateOnly) {
    // Synthetic validation only, never a real conversion or test lead dispatch.
    event = { id: `validate_${crypto.randomUUID()}`, type: "lead_created", timestamp_ms: Date.now(),
      source_url: "https://zpzaken.nl/bav-zzp", action_source: "web", data: { type: "customer_action" } };
  } else if ("aanvraag_id" in parsed.data) {
    aanvraagId = parsed.data.aanvraag_id;
    const { data: lead, error } = await db.from("leads").select("id,type,is_test,created_at,extra_data").eq("id", aanvraagId).maybeSingle();
    if (error) return response({ error: "lead_read_failed" }, 503);
    event = lead ? maakOpenaiLeadEvent(lead) : null;
    if (!event) return response({ status: "overgeslagen" });
    if (event.timestamp_ms < Date.now() - 7 * 86400000) return response({ status: "overgeslagen", reason: "expired" });
  }
  if (!event) return response({ error: "invalid_input" }, 400);
  // A unique INSERT claims the event before network effects. No automatic uncertain retries.
  const { error: claimError } = await db.from("openai_ads_conversie_log").insert({ aanvraag_id: aanvraagId, event_id: event.id, validate_only: validateOnly, status: "bezig" });
  if (claimError) return claimError.code === "23505" ? response({ status: "al_geclaimd", event_id: event.id }) : response({ error: "log_claim_failed" }, 503);
  let httpCode: number | null = null;
  let status = "onzeker";
  let fout: string | null = "network_outcome_unknown";
  let providerResult: Record<string, unknown> = {};
  try {
    const result = await fetch(OPENAI_ADS_ENDPOINT, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ validate_only: validateOnly, events: [event] }),
    });
    httpCode = result.status;
    status = result.ok ? (validateOnly ? "gevalideerd" : "verzonden") : "fout";
    fout = result.ok ? null : `provider_http_${result.status}`;
    const json = await result.json().catch(() => null);
    // Return only numeric/boolean provider acknowledgement, never reflected strings or secrets.
    if (json && typeof json === "object") for (const [k, v] of Object.entries(json)) {
      if (/^[a-z_]{1,40}$/.test(k) && (typeof v === "number" || typeof v === "boolean")) providerResult[k] = v;
    }
  } catch { /* Never log fetch exceptions, headers, body or credentials. */ }
  const { error: logError } = await db.from("openai_ads_conversie_log").update({ status, http_code: httpCode, fout, bijgewerkt_op: new Date().toISOString() }).eq("event_id", event.id);
  return response({ status, event_id: event.id, validate_only: validateOnly, http_code: httpCode, provider_result: providerResult, ...(fout ? { error: fout } : {}), ...(logError ? { log_error: "result_log_failed" } : {}) }, status === "fout" || status === "onzeker" || logError ? 502 : 200);
});