// Notificatiemails voor nieuwe aanvragen.
//
// SECURITY: deze functie is NIET vrij aanroepbaar met vrije inhoud.
// Twee toegestane aanroepvormen:
//   1. Interne aanroep (andere edge function) met header x-internal-secret
//      === INTERNAL_FUNCTION_SECRET. Alleen dan mag type/inhoud meegegeven worden.
//   2. Publieke aanroep vanaf het website-formulier met uitsluitend { type, lead_id }.
//      De inhoud van de mail wordt dan volledig uit de database (leads) opgebouwd,
//      de lead moet net (<15 min) zijn aangemaakt, en er mag nog geen notificatie
//      voor die lead gelogd zijn. Zo kan niemand vanaf een willekeurige site
//      eigen tekst of eigen ontvangers laten mailen, en niet spammen.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createMailGate, getFromAddress } from "../_shared/mail.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const MAX_LEAD_AGE_MS = 15 * 60 * 1000;

async function logNotification(entry: {
  lead_type: string;
  lead_id?: string | null;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  resend_message_id?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("lead_notification_log").insert({
      lead_type: entry.lead_type,
      lead_id: entry.lead_id ?? null,
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
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Mail {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function internEmail(from: string, titel: string, rows: Array<[string, string]>, blok?: string): Mail {
  return {
    from,
    to: ["info@zpzaken.nl"],
    subject: titel,
    html: `
      <h2>${escapeHtml(titel)}</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 12px;font-weight:bold;">${escapeHtml(k)}</td><td style="padding:6px 12px;">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
      ${
        blok
          ? `<div style="margin-top:16px;padding:16px;background:#f5f5f5;border-radius:8px;"><p style="white-space:pre-line;">${escapeHtml(blok)}</p></div>`
          : ""
      }
      <p style="margin-top:16px;color:#666;">Dit bericht is automatisch verstuurd via zpzaken.nl</p>
    `,
  };
}

function bevestigingEmail(from: string, to: string, voornaam: string): Mail {
  return {
    from,
    to: [to],
    subject: "Jouw aanmelding bij ZP Zaken is ontvangen",
    html: `
      <div style="font-family:sans-serif;max-width:520px;">
        <h2 style="color:#1a1a1a;">Bedankt voor je aanmelding, ${escapeHtml(voornaam)}!</h2>
        <p>We hebben je aanmelding in goede orde ontvangen.</p>
        <p><strong>Wat kun je verwachten?</strong></p>
        <ul>
          <li>Je krijgt binnen 24 uur bericht</li>
          <li>We bellen je voor een kort persoonlijk gesprek</li>
          <li>Na akkoord ben je direct verzekerd</li>
        </ul>
        <p>Heb je in de tussentijd vragen? Bel ons gerust op <strong>020 - 457 3077</strong> of mail naar <a href="mailto:info@zpzaken.nl">info@zpzaken.nl</a>.</p>
        <p style="margin-top:24px;">Met vriendelijke groet,<br/><strong>Team ZP Zaken</strong></p>
      </div>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return json({ error: "Email service not configured" }, 500);
  }

  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
  const provided = req.headers.get("x-internal-secret") ?? "";
  const isInternal = internalSecret.length > 0 && provided === internalSecret;

  try {
    const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return json({ error: "invalid_body" }, 400);
    }

    const type = String(payload.type ?? "");
    const from = getFromAddress();
    const gate = createMailGate("send-notification", req);
    const emails: Mail[] = [];
    let leadId: string | null = null;
    let logType = type || "onbekend";

    if (isInternal) {
      // Interne aanroep: inhoud mag meegegeven worden (bv. Exact-sync foutmelding).
      const naam = String(payload.naam ?? "-");
      const email = String(payload.email ?? "-");
      const telefoon = String(payload.telefoon ?? "-");
      const dekking = String(payload.dekking ?? "-");
      leadId = typeof payload.lead_id === "string" && UUID_RE.test(payload.lead_id) ? payload.lead_id : null;
      emails.push(
        internEmail(from, `Melding (${type || "intern"}): ${naam}`, [
          ["Naam", naam],
          ["E-mail", email],
          ["Telefoon", telefoon],
          ["Details", dekking],
        ]),
      );
    } else {
      // Publieke aanroep: alleen { type, lead_id }. Inhoud komt uit de database.
      if (type !== "contact" && type !== "bav") {
        return json({ error: "forbidden" }, 403);
      }
      const rawId = payload.lead_id;
      if (typeof rawId !== "string" || !UUID_RE.test(rawId)) {
        return json({ error: "forbidden" }, 403);
      }
      leadId = rawId;
      logType = type;

      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, created_at, type, voornaam, achternaam, email, telefoon, beroep, opmerkingen, verzekering_type")
        .eq("id", leadId)
        .maybeSingle();

      if (!lead) return json({ error: "forbidden" }, 403);

      if (Date.now() - new Date(lead.created_at as string).getTime() > MAX_LEAD_AGE_MS) {
        return json({ error: "forbidden" }, 403);
      }

      // Eenmalig: al gelogd voor deze lead => niets opnieuw versturen.
      const { count } = await supabaseAdmin
        .from("lead_notification_log")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId);
      if ((count ?? 0) > 0) {
        return json({ success: true, skipped: "already_notified" }, 200);
      }

      const naam = `${lead.voornaam ?? ""} ${lead.achternaam ?? ""}`.trim() || String(lead.email ?? "-");
      const klantEmail = String(lead.email ?? "");

      if (type === "bav") {
        emails.push(
          internEmail(from, `Nieuwe BAV-aanmelding: ${naam}`, [
            ["Naam", naam],
            ["E-mail", klantEmail],
            ["Telefoon", String(lead.telefoon ?? "-")],
            ["Gewenste dekking", String(lead.verzekering_type ?? "-")],
          ]),
        );
        if (klantEmail) {
          emails.push(bevestigingEmail(from, klantEmail, String(lead.voornaam ?? "").split(" ")[0] || naam));
        }
      } else {
        emails.push(
          internEmail(
            from,
            `Nieuw contactverzoek via zpzaken: ${naam}`,
            [
              ["Naam", naam],
              ["E-mail", klantEmail],
              ["Telefoon", String(lead.telefoon ?? "-")],
              ["Beroep", String(lead.beroep ?? "-")],
            ],
            String(lead.opmerkingen ?? ""),
          ),
        );
      }
    }

    const plannedEmails = emails
      .map((email) => gate.plan({ to: email.to, subject: email.subject, html: email.html }))
      .filter((plan) => plan.send)
      .map((plan) => ({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html }));

    const results = await Promise.allSettled(
      plannedEmails.map((email) =>
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
              lead_type: logType,
              lead_id: leadId,
              recipient: email.to[0],
              subject: email.subject,
              status: "failed",
              error_message: `Resend ${res.status}: ${JSON.stringify(body)}`,
            });
            throw new Error(`Resend API error [${res.status}]`);
          }
          await logNotification({
            lead_type: logType,
            lead_id: leadId,
            recipient: email.to[0],
            subject: email.subject,
            status: "sent",
            resend_message_id: body?.id ?? null,
          });
          return body;
        })
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) console.error("Some emails failed:", failed);

    return json({ success: true, sent: results.length - failed.length, failed: failed.length });
  } catch (error) {
    console.error("Error in send-notification:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
