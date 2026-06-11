import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";

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

    if (resend) {
      try {
        await resend.emails.send({
          from: "ZP Zaken <noreply@zpzaken.nl>",
          to: ["info@zpzaken.nl"],
          subject,
          html: baseHtml,
          reply_to: v.email,
        });
        await resend.emails.send({
          from: "ZP Zaken <noreply@zpzaken.nl>",
          to: [v.email],
          subject: `Bevestiging: ${labels[v.type]}`,
          html: `
            <p>Hoi ${v.voornaam},</p>
            <p>We hebben je aanvraag (<strong>${labels[v.type].toLowerCase()}</strong>) ontvangen.
            Een medewerker neemt binnen 24 uur contact met je op.</p>
            <h3>Wat je hebt doorgegeven</h3>
            <ul>${renderDetails(v.details)}</ul>
            <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
          `,
        });
      } catch (mailErr) {
        console.error("Resend error", mailErr);
        // Niet falen op mail-fout — record staat al in DB.
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
