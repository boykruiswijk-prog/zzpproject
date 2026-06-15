// Centrale Edge Function voor lead-notificaties.
// Verstuurt mail via Resend en logt in lead_notification_log.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const resendKey = Deno.env.get("RESEND_API_KEY");
const resend = resendKey ? new Resend(resendKey) : null;

const LEAD_LABELS: Record<string, string> = {
  contact: "Contactverzoek",
  bav: "BAV-aanvraag",
  "screening-basis": "Screening Basis (€49)",
  "screening-uitgebreid": "Screening Uitgebreid (€129)",
  "screening-compleet": "Screening Compleet (€179)",
  "mijn-zp-certificaat": "Certificaat-aanvraag",
  "mijn-zp-pauzeren": "Pauzeer-aanvraag",
  "mijn-zp-documenten": "Documenten opgevraagd",
  "verzekering-aanvraag": "Verzekeringsaanvraag",
};

const SUBJECTS: Record<string, (ref: string) => string> = {
  contact: (r) => `Nieuw contactverzoek via zpzaken.nl - ${r}`,
  bav: (r) => `Nieuwe BAV-aanvraag via zpzaken.nl - ${r}`,
  "screening-basis": (r) => `Nieuwe screening (Basis €49) via zpzaken.nl - ${r}`,
  "screening-uitgebreid": (r) => `Nieuwe screening (Uitgebreid €129) via zpzaken.nl - ${r}`,
  "screening-compleet": (r) => `Nieuwe screening (Compleet €179) via zpzaken.nl - ${r}`,
  "mijn-zp-certificaat": (r) => `Nieuwe certificaat-aanvraag via zpzaken.nl - ${r}`,
  "mijn-zp-pauzeren": (r) => `Nieuwe pauzeer-aanvraag via zpzaken.nl - ${r}`,
  "mijn-zp-documenten": (r) => `Documenten opgevraagd via zpzaken.nl - ${r}`,
  "verzekering-aanvraag": (r) => `Nieuwe verzekeringsaanvraag via zpzaken.nl - ${r}`,
};

const schema = z.object({
  type: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  reference: z.string().default(""),
  recipientEmail: z.string().email().optional(),
  userEmail: z.string().email().optional().nullable(),
  fields: z.record(z.any()).default({}),
});

function esc(s: unknown): string {
  return String(s ?? "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(label: string, fields: Record<string, unknown>, leadId?: string | null): string {
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:bold;background:#f7f7f7;border:1px solid #eee">${esc(k)}</td><td style="padding:6px 12px;border:1px solid #eee">${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`)
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#222">
      <h2 style="color:#E53E2F;border-bottom:2px solid #E53E2F;padding-bottom:8px">${esc(label)}</h2>
      <p>Hallo team,</p>
      <p>Er is een nieuwe <strong>${esc(label.toLowerCase())}</strong> binnengekomen via zpzaken.nl. Hieronder de gegevens:</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px">${rows}</table>
      ${leadId ? `<p style="margin-top:24px;color:#666;font-size:12px">Aanvraag-ID: ${esc(leadId)}<br/>Bekijk en behandel deze aanvraag in het admin-dashboard.</p>` : ""}
    </div>
  `;
}

function renderText(label: string, fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v ?? "-"}`).join("\n");
  return `Nieuwe ${label} via zpzaken.nl\n\n${lines}\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "validation", details: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { type, leadId, reference, recipientEmail, userEmail, fields } = parsed.data;
    const recipient = recipientEmail || "info@zpzaken.nl";
    const label = LEAD_LABELS[type] || type;
    const subject = (SUBJECTS[type] || ((r: string) => `Nieuwe lead (${type}) via zpzaken.nl - ${r}`))(reference || leadId || "");

    if (!resend) {
      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
        subject, status: "failed", error_message: "RESEND_API_KEY missing", metadata: fields,
      });
      return new Response(JSON.stringify({ success: false, error: "email_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = renderHtml(label, fields, leadId);
    const text = renderText(label, fields);

    try {
      const sendRes = await resend.emails.send({
        from: "ZP Zaken <noreply@zpzaken.nl>",
        to: [recipient],
        cc: userEmail ? [userEmail] : undefined,
        reply_to: (fields.email as string) || undefined,
        subject, html, text,
      });

      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
        subject, status: "sent",
        resend_message_id: (sendRes as any)?.data?.id ?? null,
        metadata: fields,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (mailErr) {
      const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error("Resend error", msg);
      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
        subject, status: "failed", error_message: msg, metadata: fields,
      });
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Unhandled", err);
    return new Response(JSON.stringify({ error: "unhandled" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
