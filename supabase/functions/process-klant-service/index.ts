import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";
import { maybeFormatDate } from "../_shared/dateFormat.ts";
import { createMailGate } from "../_shared/mail.ts";
import { valideerOpzegdatum, valideerToelichting } from "../_shared/opzegValidatie.ts";

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
  type: z.enum(["certificaat", "pauzeren", "documenten", "opzeggen"]),
  voornaam: z.string().trim().min(1).max(100),
  achternaam: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  telefoon: z.string().trim().min(8).max(20),
  polisnummer: z.string().trim().min(1).max(50),
  details: z.record(z.any()).default({}),
});

const labels: Record<string, string> = {
  certificaat: "Polis opgevraagd",
  pauzeren: "Pauzeringsaanvraag",
  documenten: "Documenten opgevraagd",
  opzeggen: "Opzegging",
};

const DATE_KEYS = new Set(["opzegdatum", "ingangsdatum", "pauzedatum", "geboortedatum", "datum"]);

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function fmtValue(key: string, v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v == null) return "-";
  if (DATE_KEYS.has(key)) return maybeFormatDate(v);
  return String(v);
}

function renderDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(fmtValue(k, v))}</li>`)
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

    // Server-side dezelfde regels als het formulier: reden verplicht, toelichting bij "Anders", datum vandaag of later.
    if (v.type === "opzeggen") {
      const d = v.details ?? {};
      const fout = (!d.reden ? "Kies een reden." : null)
        ?? valideerToelichting(d.reden, d.toelichting)
        ?? valideerOpzegdatum(d.opzegdatum)
        ?? (d.bevestigd === true ? null : "Bevestiging is verplicht.")
        ?? (d.bedrijfsnaam === undefined || (typeof d.bedrijfsnaam === "string" && d.bedrijfsnaam.length <= 200) ? null : "Bedrijfsnaam is te lang.");
      if (fout) {
        return new Response(JSON.stringify({ error: "validation", melding: fout }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Omgevingsbepaling + preview-redirect (max. één mail per verzendactie); preview-aanvragen zijn testdata.
    const gate = createMailGate("process-klant-service", req);

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
        is_test: !gate.isProduction,
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
      <p><strong>Naam:</strong> ${escapeHtml(v.voornaam)} ${escapeHtml(v.achternaam)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(v.email)}</p>
      <p><strong>Telefoon:</strong> ${escapeHtml(v.telefoon)}</p>
      <p><strong>Polisnummer:</strong> ${escapeHtml(v.polisnummer)}</p>
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


    if (resend) {
      const sendAndLog = async (to: string, sub: string, html: string) => {
        const plan = gate.plan({ to, subject: sub, html });
        if (!plan.send) return;
        try {
          const res: any = await resend.emails.send({
            from: plan.from,
            to: plan.to,
            subject: plan.subject,
            html: plan.html,
            replyTo: gate.isProduction ? v.email : undefined,
          });
          if (res?.error) {
            await logEntry({ recipient: plan.to[0], subject: plan.subject, status: "failed", error_message: `${res.error.name ?? "resend"}: ${res.error.message ?? JSON.stringify(res.error)}` });
          } else {
            await logEntry({ recipient: plan.to[0], subject: plan.subject, status: "sent", resend_message_id: res?.data?.id ?? null });
          }
        } catch (mailErr) {
          const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
          await logEntry({ recipient: plan.to[0], subject: plan.subject, status: "failed", error_message: msg });
        }
      };

      await sendAndLog("info@zpzaken.nl", subject, baseHtml);
      await sendAndLog(
        v.email,
        `Bevestiging: ${labels[v.type]}`,
        `
          <p>Hoi ${escapeHtml(v.voornaam)},</p>
          <p>We hebben je aanvraag (<strong>${labels[v.type].toLowerCase()}</strong>) ontvangen.
          Een medewerker neemt binnen 24 uur contact met je op.</p>
          <h3>Wat je hebt doorgegeven</h3>
          <ul>${renderDetails(v.details)}</ul>
          <p>Met vriendelijke groet,<br/>Team ZP Zaken</p>
        `,
      );
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
