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

const schema = z.object({
  type: z.enum(["certificaat", "pauzeren", "documenten"]),
  voornaam: z.string().trim().min(1).max(100),
  achternaam: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  telefoon: z.string().trim().min(8).max(20),
  polisnummer: z.string().trim().min(1).max(50),
  details: z.record(z.any()).default({}),
});

const labels: Record<string, string> = {
  certificaat: "Certificaat opgevraagd",
  pauzeren: "Pauzeringsaanvraag",
  documenten: "Documenten opgevraagd",
};

function renderDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([k, v]) => `<li><strong>${k}:</strong> ${Array.isArray(v) ? v.join(", ") : String(v ?? "-")}</li>`)
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "validation", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const v = parsed.data;

    const { data, error } = await supabase
      .from("klant_service_aanvragen")
      .insert({
        type: v.type,
        voornaam: v.voornaam,
        achternaam: v.achternaam,
        email: v.email,
        telefoon: v.telefoon,
        polisnummer: v.polisnummer,
        details: v.details,
      })
      .select()
      .single();

    if (error) {
      console.error("DB insert error", error);
      return new Response(JSON.stringify({ error: "db_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `Nieuwe ${labels[v.type]} via zpzaken.nl`;
    const baseHtml = `
      <h2>${labels[v.type]}</h2>
      <p><strong>Naam:</strong> ${v.voornaam} ${v.achternaam}</p>
      <p><strong>E-mail:</strong> ${v.email}</p>
      <p><strong>Telefoon:</strong> ${v.telefoon}</p>
      <p><strong>Polisnummer:</strong> ${v.polisnummer}</p>
      <h3>Details</h3>
      <ul>${renderDetails(v.details)}</ul>
      <p style="color:#888;font-size:12px">Aanvraag-ID: ${data.id}</p>
    `;

    const leadType = `mijn-zp-${v.type}`;
    const logEntry = async (entry: {
      recipient: string;
      subject: string;
      status: "sent" | "failed";
      resend_message_id?: string | null;
      error_message?: string | null;
      cc?: string | null;
    }) => {
      try {
        await supabase.from("lead_notification_log").insert({
          lead_type: leadType,
          lead_id: data.id,
          recipient: entry.recipient,
          cc: entry.cc ?? null,
          subject: entry.subject,
          status: entry.status,
          resend_message_id: entry.resend_message_id ?? null,
          error_message: entry.error_message ?? null,
          metadata: { type: v.type, email: v.email, polisnummer: v.polisnummer },
        });
      } catch (e) {
        console.error("log insert failed:", e);
      }
    };
    const FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <onboarding@resend.dev>";

    if (resend) {
      try {
        const adminRes = await resend.emails.send({
          from: FROM_ADDRESS,
          to: ["info@zpzaken.nl"],
          subject,
          html: baseHtml,
          reply_to: v.email,
        });
        await logEntry({
          recipient: "info@zpzaken.nl",
          subject,
          status: "sent",
          resend_message_id: (adminRes as any)?.data?.id ?? null,
        });
      } catch (mailErr) {
        const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error("Resend admin error", msg);
        await logEntry({ recipient: "info@zpzaken.nl", subject, status: "failed", error_message: msg });
      }

      const confirmSubject = `Bevestiging: ${labels[v.type]}`;
      try {
        const userRes = await resend.emails.send({
          from: FROM_ADDRESS,
          to: [v.email],
          subject: confirmSubject,
          html: `
            <p>Hoi ${v.voornaam},</p>
            <p>We hebben je aanvraag (<strong>${labels[v.type].toLowerCase()}</strong>) ontvangen.
            Een medewerker neemt binnen 24 uur contact met je op.</p>
            <h3>Wat je hebt doorgegeven</h3>
            <ul>${renderDetails(v.details)}</ul>
            <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
          `,
        });
        await logEntry({
          recipient: v.email,
          subject: confirmSubject,
          status: "sent",
          resend_message_id: (userRes as any)?.data?.id ?? null,
        });
      } catch (mailErr) {
        const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error("Resend user error", msg);
        await logEntry({ recipient: v.email, subject: confirmSubject, status: "failed", error_message: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled", err);
    return new Response(JSON.stringify({ error: "unhandled" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
