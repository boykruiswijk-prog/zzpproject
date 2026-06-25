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
  "mijn-zp-certificaat": "Polis-aanvraag",
  "mijn-zp-pauzeren": "Pauzeer-aanvraag",
  "mijn-zp-documenten": "Documenten opgevraagd",
  "mijn-zp-opzeggen": "Opzegging",
  "verzekering-aanvraag": "Verzekeringsaanvraag",
  "offerte-aanvraag": "Offerteaanvraag",
};

const SUBJECTS: Record<string, (ref: string) => string> = {
  contact: (r) => `Nieuw contactverzoek via zpzaken.nl - ${r}`,
  bav: (r) => `Nieuwe BAV-aanvraag via zpzaken.nl - ${r}`,
  "screening-basis": (r) => `Nieuwe screening (Basis €49) via zpzaken.nl - ${r}`,
  "screening-uitgebreid": (r) => `Nieuwe screening (Uitgebreid €129) via zpzaken.nl - ${r}`,
  "screening-compleet": (r) => `Nieuwe screening (Compleet €179) via zpzaken.nl - ${r}`,
  "mijn-zp-certificaat": (r) => `Nieuwe polis-aanvraag via zpzaken.nl - ${r}`,
  "mijn-zp-pauzeren": (r) => `Nieuwe pauzeer-aanvraag via zpzaken.nl - ${r}`,
  "mijn-zp-documenten": (r) => `Documenten opgevraagd via zpzaken.nl - ${r}`,
  "mijn-zp-opzeggen": (r) => `Nieuwe opzegging via zpzaken.nl - ${r}`,
  "verzekering-aanvraag": (r) => `Nieuwe verzekeringsaanvraag via zpzaken.nl - ${r}`,
  "offerte-aanvraag": (r) => `Nieuwe offerteaanvraag via zpzaken.nl - ${r}`,
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

const LABEL_MAP: Record<string, string> = {
  naam: "Naam",
  contact_naam: "Naam",
  email: "E-mail",
  telefoon: "Telefoon",
  bedrijfsnaam: "Bedrijfsnaam",
  kvk: "KvK-nummer",
  kvk_nummer: "KvK-nummer",
  pakket: "Pakket",
  gekozen_pakket: "Pakket",
  dekking: "Dekking",
  betaalwijze: "Betaalwijze",
  ingangsdatum: "Ingangsdatum",
};

function prettyLabel(key: string): string {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  const spaced = key.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderHtml(label: string, fields: Record<string, unknown>, leadId?: string | null, deeplink?: string | null): string {
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><td style="padding:10px 14px;font-weight:600;color:#333;background:#fafafa;border:1px solid #e5e5e5;width:200px">${esc(prettyLabel(k))}</td><td style="padding:10px 14px;border:1px solid #e5e5e5;color:#222">${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`)
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#222;line-height:1.5">
      <h2 style="color:#222;font-size:18px;font-weight:600;margin:0 0 16px 0">${esc(label)}</h2>
      <p style="margin:0 0 8px 0">Beste collega,</p>
      <p style="margin:0 0 16px 0">Hieronder de gegevens van een nieuwe aanvraag via zpzaken.nl.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:8px">${rows}</table>
      ${deeplink ? `<p style="margin-top:24px"><a href="${esc(deeplink)}" style="display:inline-block;padding:10px 18px;background:#E53E2F;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Open in admin</a></p>` : ""}
      ${leadId ? `<p style="margin-top:16px;color:#888;font-size:12px">Aanvraag-ID: ${esc(leadId)}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 12px 0" />
      <p style="margin:0;color:#888;font-size:12px"><strong style="color:#555">ZP Zaken</strong><br/>Dit is een automatische notificatie vanuit het zpzaken.nl platform.</p>
    </div>
  `;
}

function renderText(label: string, fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v ?? "-"}`).join("\n");
  return `Nieuwe ${label} via zpzaken.nl\n\n${lines}\n`;
}

const CUSTOMER_INTRO: Record<string, string> = {
  bav: "We hebben je BAV-aanvraag in goede orde ontvangen. Onze acceptant beoordeelt je aanvraag en neemt binnen één werkdag contact met je op.",
  "verzekering-aanvraag": "We hebben je verzekeringsaanvraag in goede orde ontvangen. Een van onze adviseurs neemt binnen één werkdag contact met je op om de aanvraag af te ronden.",
  "offerte-aanvraag": "We hebben je offerteaanvraag in goede orde ontvangen. Je ontvangt binnen één werkdag een persoonlijke offerte van ons.",
  contact: "Bedankt voor je bericht. We nemen zo spoedig mogelijk, uiterlijk binnen één werkdag, contact met je op.",
};

function renderCustomerHtml(type: string, label: string, fields: Record<string, unknown>): string {
  const intro = CUSTOMER_INTRO[type] || "We hebben je aanvraag in goede orde ontvangen en nemen binnen één werkdag contact met je op.";
  const SHOW_KEYS = new Set([
    "naam", "contact_naam", "bedrijfsnaam", "kvk_nummer", "pakket", "gekozen_pakket",
    "dekking", "betaalwijze", "ingangsdatum", "verzekering", "premie",
  ]);
  const visible = Object.entries(fields).filter(([k, v]) => SHOW_KEYS.has(k) && v != null && String(v).trim() !== "" && String(v).trim() !== "-");
  const rows = visible
    .map(([k, v]) => `<tr><td style="padding:10px 14px;font-weight:600;color:#333;background:#fafafa;border:1px solid #e5e5e5;width:200px">${esc(prettyLabel(k))}</td><td style="padding:10px 14px;border:1px solid #e5e5e5;color:#222">${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`)
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#222;line-height:1.6">
      <h2 style="color:#222;font-size:18px;font-weight:600;margin:0 0 16px 0">Bevestiging van je aanvraag</h2>
      <p style="margin:0 0 14px 0">Beste relatie,</p>
      <p style="margin:0 0 18px 0">${esc(intro)}</p>
      ${rows ? `<p style="margin:0 0 8px 0;font-weight:600;color:#333">Samenvatting van je gegevens</p><table style="border-collapse:collapse;width:100%;margin:0 0 18px 0">${rows}</table>` : ""}
      <p style="margin:0 0 14px 0">Heb je tussentijds een vraag? Bel ons gerust op <a href="tel:+31204573077" style="color:#E53E2F;text-decoration:none">020 - 457 3077</a> of mail naar <a href="mailto:info@zpzaken.nl" style="color:#E53E2F;text-decoration:none">info@zpzaken.nl</a>.</p>
      <p style="margin:0 0 24px 0">Met vriendelijke groet,<br/>Team ZP Zaken</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:8px 0 12px 0" />
      <p style="margin:0;color:#888;font-size:12px"><strong style="color:#555">ZP Zaken</strong><br/>Dit is een automatisch verzonden bevestiging. Reageren op deze mail kan rechtstreeks naar info@zpzaken.nl.</p>
    </div>
  `;
}

function renderCustomerText(type: string, fields: Record<string, unknown>): string {
  const intro = CUSTOMER_INTRO[type] || "We hebben je aanvraag in goede orde ontvangen en nemen binnen één werkdag contact met je op.";
  const SHOW_KEYS = new Set(["naam","contact_naam","bedrijfsnaam","kvk_nummer","pakket","gekozen_pakket","dekking","betaalwijze","ingangsdatum","verzekering","premie"]);
  const lines = Object.entries(fields)
    .filter(([k, v]) => SHOW_KEYS.has(k) && v != null && String(v).trim() !== "" && String(v).trim() !== "-")
    .map(([k, v]) => `- ${prettyLabel(k)}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
  return `Bevestiging van je aanvraag\n\n${intro}\n\n${lines ? `Samenvatting:\n${lines}\n\n` : ""}Met vriendelijke groet,\nTeam ZP Zaken\n020 - 457 3077\ninfo@zpzaken.nl\n`;
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
    const TO_DEFAULT = "info@zpzaken.nl";
    const BCC_DEFAULT = ["boy.kruiswijk@zpzaken.nl", "ellen.baars@zpzaken.nl"];
    const baseRecipient = recipientEmail || TO_DEFAULT;

    // Env-guard: in preview/local gaan alle mails naar 1 test-adres met [PREVIEW] prefix.
    const appEnv = (Deno.env.get("APP_ENV") || "production").toLowerCase();
    const isProd = appEnv === "production";
    const recipient = isProd ? baseRecipient : "boy.kruiswijk@zpzaken.nl";
    const bccList = isProd ? BCC_DEFAULT : [];
    const ccList = isProd && userEmail ? [userEmail] : undefined;

    const label = LEAD_LABELS[type] || type;
    const subjBase = (SUBJECTS[type] || ((r: string) => `Nieuwe lead (${type}) via zpzaken.nl - ${r}`))(reference || leadId || "");
    const subject = isProd ? subjBase : `[PREVIEW] ${subjBase}`;

    const adminBase = (Deno.env.get("ADMIN_BASE_URL") || "https://zpzaken.nl").replace(/\/$/, "");
    const deeplink = leadId ? `${adminBase}/admin/leads/${leadId}` : null;

    if (!resend) {
      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
        subject, status: "failed", error_message: "RESEND_API_KEY missing", metadata: fields,
      });
      return new Response(JSON.stringify({ success: false, error: "email_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = renderHtml(label, fields, leadId, deeplink);
    const text = renderText(label, fields) + (deeplink ? `\nOpen in admin: ${deeplink}\n` : "");

    try {
      const sendRes: any = await resend.emails.send({
        from: Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>",
        to: [recipient],
        cc: ccList,
        bcc: bccList.length ? bccList : undefined,
        reply_to: isProd ? ((fields.email as string) || undefined) : undefined,
        subject, html, text,
      });

      if (sendRes?.error) {
        const msg = `${sendRes.error.name ?? "resend"}: ${sendRes.error.message ?? JSON.stringify(sendRes.error)}`;
        await supabase.from("lead_notification_log").insert({
          lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
          subject, status: "failed", error_message: msg, metadata: fields,
        });
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient, cc: userEmail ?? null,
        subject, status: "sent",
        resend_message_id: sendRes?.data?.id ?? null,
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
