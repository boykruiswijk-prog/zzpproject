import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabaseLog = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function logNotification(entry: {
  lead_type: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  resend_message_id?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseLog.from("lead_notification_log").insert({
      lead_type: entry.lead_type,
      recipient: entry.recipient,
      subject: entry.subject,
      status: entry.status,
      resend_message_id: entry.resend_message_id ?? null,
      error_message: entry.error_message ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.error("lead_notification_log insert failed:", e);
  }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BavPayload {
  type: "bav";
  naam: string;
  email: string;
  telefoon: string;
  dekking: string;
}

interface ContactPayload {
  type: "contact";
  naam: string;
  email: string;
  bericht: string;
}

type EmailPayload = BavPayload | ContactPayload;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload: EmailPayload = await req.json();
    const emails: Array<{ from: string; to: string[]; subject: string; html: string }> = [];

    const from = "ZP Zaken <onboarding@resend.dev>";

    if (payload.type === "bav") {
      // 1. Notification to info@zpzaken.nl
      emails.push({
        from,
        to: ["info@zpzaken.nl"],
        subject: `Nieuwe BAV-aanmelding — ${payload.naam}`,
        html: `
          <h2>Nieuwe BAV-aanmelding</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:6px 12px;font-weight:bold;">Naam</td><td style="padding:6px 12px;">${escapeHtml(payload.naam)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">E-mail</td><td style="padding:6px 12px;">${escapeHtml(payload.email)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">Telefoon</td><td style="padding:6px 12px;">${escapeHtml(payload.telefoon)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">Gewenste dekking</td><td style="padding:6px 12px;">${escapeHtml(payload.dekking)}</td></tr>
          </table>
          <p style="margin-top:16px;color:#666;">Dit bericht is automatisch verstuurd via zpzaken.nl</p>
        `,
      });

      // 2. Confirmation to client
      emails.push({
        from,
        to: [payload.email],
        subject: "Jouw aanmelding bij ZP Zaken is ontvangen",
        html: `
          <div style="font-family:sans-serif;max-width:520px;">
            <h2 style="color:#1a1a1a;">Bedankt voor je aanmelding, ${escapeHtml(payload.naam.split(" ")[0])}!</h2>
            <p>We hebben je BAV-aanmelding in goede orde ontvangen.</p>
            <p><strong>Wat kun je verwachten?</strong></p>
            <ul>
              <li>Wij nemen binnen 24 uur contact met je op</li>
              <li>Je ontvangt een persoonlijk adviesgesprek</li>
              <li>Na akkoord ben je direct verzekerd</li>
            </ul>
            <p>Heb je in de tussentijd vragen? Bel ons gerust op <strong>020 - 457 3077</strong> of mail naar <a href="mailto:info@zpzaken.nl">info@zpzaken.nl</a>.</p>
            <p style="margin-top:24px;">Met vriendelijke groet,<br/><strong>Team ZP Zaken</strong></p>
          </div>
        `,
      });
    } else if (payload.type === "contact") {
      // Notification to info@zpzaken.nl
      emails.push({
        from,
        to: ["info@zpzaken.nl"],
        subject: `Nieuw contactverzoek via zpzaken — ${payload.naam}`,
        html: `
          <h2>Nieuw contactverzoek</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;">
            <tr><td style="padding:6px 12px;font-weight:bold;">Naam</td><td style="padding:6px 12px;">${escapeHtml(payload.naam)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">E-mail</td><td style="padding:6px 12px;">${escapeHtml(payload.email)}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;">
            <strong>Bericht:</strong>
            <p style="white-space:pre-line;">${escapeHtml(payload.bericht)}</p>
          </div>
          <p style="margin-top:16px;color:#666;">Dit bericht is automatisch verstuurd via zpzaken.nl</p>
        `,
      });
    }

    // Send all emails via Resend (per-email logging into lead_notification_log)
    const leadType = payload.type === "bav" ? "bav" : "contact";
    const results = await Promise.allSettled(
      emails.map((email) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(email),
        }).then(async (res) => {
          const body = await res.json();
          if (!res.ok) {
            console.error("Resend error:", JSON.stringify(body));
            await logNotification({
              lead_type: leadType,
              recipient: email.to[0],
              subject: email.subject,
              status: "failed",
              error_message: `Resend ${res.status}: ${JSON.stringify(body)}`,
            });
            throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(body)}`);
          }
          await logNotification({
            lead_type: leadType,
            recipient: email.to[0],
            subject: email.subject,
            status: "sent",
            resend_message_id: body?.id ?? null,
          });
          return body;
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("Some emails failed:", failed);
    }

    return new Response(
      JSON.stringify({ success: true, sent: results.length - failed.length, failed: failed.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
