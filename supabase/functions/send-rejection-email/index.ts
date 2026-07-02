// Verstuurt de vriendelijke afwijsmail naar de klant en logt in lead_notification_log.
// Volgt exact het patroon van send-lead-notification (Resend + resolveEnvironment).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";
import { resolveEnvironment } from "../_shared/environment.ts";

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

const schema = z.object({
  leadId: z.string().uuid(),
  email: z.string().email(),
});

const LEAD_TYPE = "afwijzing";

function renderHtml(): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#222;line-height:1.6">
      <h2 style="color:#E53E2F;font-size:18px;font-weight:600;margin:0 0 16px 0">Bericht over je aanvraag</h2>
      <p style="margin:0 0 14px 0">Beste relatie,</p>
      <p style="margin:0 0 14px 0">
        Hartelijk dank dat je je aanvraag bij ZP Zaken hebt ingediend. We waarderen het vertrouwen dat je in ons stelt.
      </p>
      <p style="margin:0 0 14px 0">
        Na zorgvuldige beoordeling moeten we je helaas laten weten dat we je aanvraag op dit moment niet in behandeling
        kunnen nemen. De reden hiervoor is dat je aanvraag niet aansluit bij onze huidige verzekeringsportefeuille.
        We beseffen dat dit een teleurstellend bericht is en willen benadrukken dat deze uitkomst niets
        afdoet aan je onderneming of je professionaliteit.
      </p>
      <p style="margin:0 0 14px 0">
        Heb je vragen naar aanleiding van dit bericht of wil je later opnieuw een aanvraag doen? Neem dan gerust contact
        met ons op via <a href="mailto:info@zpzaken.nl" style="color:#E53E2F;text-decoration:none">info@zpzaken.nl</a>.
        We denken graag met je mee.
      </p>
      <p style="margin:0 0 24px 0">
        We wensen je veel succes met je verdere ondernemersplannen.
      </p>
      <p style="margin:0 0 24px 0">Met vriendelijke groet,<br/>Team ZP Zaken</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:8px 0 12px 0" />
      <p style="margin:0;color:#888;font-size:12px">
        <strong style="color:#555">ZP Zaken B.V.</strong> | Zorgeloos ZZP'en
      </p>
    </div>
  `;
}

function renderText(): string {
  return [
    "Beste relatie,",
    "",
    "Hartelijk dank dat je je aanvraag bij ZP Zaken hebt ingediend. We waarderen het vertrouwen dat je in ons stelt.",
    "",
    "Na zorgvuldige beoordeling moeten we je helaas laten weten dat we je aanvraag op dit moment niet in behandeling kunnen nemen. We beseffen dat dit een teleurstellend bericht is en willen benadrukken dat deze uitkomst niets afdoet aan je onderneming of je professionaliteit.",
    "",
    "Heb je vragen naar aanleiding van dit bericht of wil je later opnieuw een aanvraag doen? Neem dan gerust contact met ons op via info@zpzaken.nl. We denken graag met je mee.",
    "",
    "We wensen je veel succes met je verdere ondernemersplannen.",
    "",
    "Met vriendelijke groet,",
    "Team ZP Zaken",
    "",
    "ZP Zaken B.V. | Zorgeloos ZZP'en",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "validation", details: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { leadId, email } = parsed.data;

    // Server-side dubbelzendbescherming: al eerder een succesvolle afwijsmail voor deze lead?
    const { data: existing } = await supabase
      .from("lead_notification_log")
      .select("id")
      .eq("lead_type", LEAD_TYPE)
      .eq("lead_id", leadId)
      .eq("status", "sent")
      .limit(1)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, skipped: "already_sent" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = resolveEnvironment(req);
    const isProd = env.isProduction;
    console.log("send-rejection-email env:", JSON.stringify(env));

    const recipient = isProd ? email : "boy.kruiswijk@zpzaken.nl";
    const subjBase = "Bericht over je aanvraag bij ZP Zaken";
    const subject = isProd ? subjBase : `[PREVIEW] ${subjBase} (origineel naar ${email})`;

    if (!resend) {
      await supabase.from("lead_notification_log").insert({
        lead_type: LEAD_TYPE, lead_id: leadId, recipient, cc: null,
        subject, status: "failed", error_message: "RESEND_API_KEY missing",
        metadata: { intended_recipient: email, env },
      });
      return new Response(JSON.stringify({ success: false, error: "email_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const sendRes: any = await resend.emails.send({
        from: Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>",
        to: [recipient],
        reply_to: "info@zpzaken.nl",
        subject,
        html: renderHtml(),
        text: renderText(),
      });

      if (sendRes?.error) {
        const msg = `${sendRes.error.name ?? "resend"}: ${sendRes.error.message ?? JSON.stringify(sendRes.error)}`;
        await supabase.from("lead_notification_log").insert({
          lead_type: LEAD_TYPE, lead_id: leadId, recipient, cc: null,
          subject, status: "failed", error_message: msg,
          metadata: { intended_recipient: email, env },
        });
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("lead_notification_log").insert({
        lead_type: LEAD_TYPE, lead_id: leadId, recipient, cc: null,
        subject, status: "sent",
        resend_message_id: sendRes?.data?.id ?? null,
        metadata: { intended_recipient: email, env },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("send-rejection-email send error", msg);
      await supabase.from("lead_notification_log").insert({
        lead_type: LEAD_TYPE, lead_id: leadId, recipient, cc: null,
        subject, status: "failed", error_message: msg,
        metadata: { intended_recipient: email, env },
      });
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-rejection-email error", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
