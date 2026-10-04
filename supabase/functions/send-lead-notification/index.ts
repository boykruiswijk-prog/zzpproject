// Centrale Edge Function voor lead-notificaties.
// Verstuurt mail via Resend en logt in lead_notification_log.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.0.0";
import { z } from "npm:zod@3.23.8";
import { resolveEnvironment } from "../_shared/environment.ts";
import { getFromAddress } from "../_shared/mail.ts";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { interneMailVelden } from "../_shared/leadVelden.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
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
  "terugbelverzoek-chat": "Terugbelverzoek via chatassistent Zeker",
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
  "terugbelverzoek-chat": (r) => `Terugbelverzoek via chat Zeker - ${r}`,
};

// ── Publieke aanroepen: type → brontabel + aanmaakkolom ──
const PUBLIC_MAX_AGE_MS = 15 * 60 * 1000;
type PublicSpec = { table: "leads" | "screening_aanvragen" | "klant_service_aanvragen"; createdCol: string };
const PUBLIC_TYPE_TABLE: Record<string, PublicSpec> = {
  contact: { table: "leads", createdCol: "created_at" },
  bav: { table: "leads", createdCol: "created_at" }, // process-bav-wizard geeft leads.id mee
  "verzekering-aanvraag": { table: "leads", createdCol: "created_at" },
  "offerte-aanvraag": { table: "leads", createdCol: "created_at" },
  "screening-basis": { table: "screening_aanvragen", createdCol: "aangemeld_op" },
  "screening-uitgebreid": { table: "screening_aanvragen", createdCol: "aangemeld_op" },
  "screening-compleet": { table: "screening_aanvragen", createdCol: "aangemeld_op" },
  "mijn-zp-certificaat": { table: "klant_service_aanvragen", createdCol: "created_at" },
  "mijn-zp-pauzeren": { table: "klant_service_aanvragen", createdCol: "created_at" },
  "mijn-zp-documenten": { table: "klant_service_aanvragen", createdCol: "created_at" },
  "mijn-zp-opzeggen": { table: "klant_service_aanvragen", createdCol: "created_at" },
};

function jsonRes(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Intern (x-internal-secret) of ingelogd teamlid → vertrouwd; al het andere is publiek.
async function isTrustedCaller(req: Request): Promise<boolean> {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
  if (secret.length > 0 && (req.headers.get("x-internal-secret") ?? "") === secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const { data } = await supabase.auth.getUser(auth.slice(7));
  const uid = data?.user?.id;
  if (!uid) return false;
  const { data: isTeam } = await supabase.rpc("is_team_member", { _user_id: uid });
  return isTeam === true;
}

// Klantsamenvatting uitsluitend uit het databaserecord (keys uit SHOW_KEYS).
function customerFieldsFromRecord(table: string, r: Record<string, unknown>): Record<string, unknown> {
  const naam = [r.voornaam, r.achternaam].filter(Boolean).join(" ");
  const out: Record<string, unknown> = { naam, bedrijfsnaam: r.bedrijfsnaam, kvk_nummer: r.kvk_nummer };
  if (table === "leads") {
    out.verzekering = r.verzekering_type;
    out.pakket = r.gekozen_pakket;
    out.dekking = r.verzekerd_bedrag;
    out.ingangsdatum = r.ingangsdatum;
  } else if (table === "screening_aanvragen") {
    out.pakket = r.screening_type;
  }
  return out;
}

const schema = z.object({
  type: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  reference: z.string().default(""),
  recipientEmail: z.string().email().optional(),
  userEmail: z.string().email().optional().nullable(),
  fields: z.record(z.any()).default({}),
  waarschuwing: z.string().max(300).optional(),
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
  if (/[A-Z ]/.test(key)) return key; // al een net label (uit leadVelden)
  const spaced = key.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderHtml(label: string, fields: Record<string, unknown>, leadId?: string | null, deeplink?: string | null, waarschuwing?: string): string {
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><td style="padding:10px 14px;font-weight:600;color:#333;background:#fafafa;border:1px solid #e5e5e5;width:200px">${esc(prettyLabel(k))}</td><td style="padding:10px 14px;border:1px solid #e5e5e5;color:#222;white-space:pre-line">${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`)
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#222;line-height:1.5">
      ${waarschuwing ? `<p style="margin:0 0 16px 0;padding:12px 14px;background:#fdecea;border:2px solid #E53E2F;border-radius:6px;color:#8a1c12;font-weight:700">${esc(waarschuwing)}</p>` : ""}
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
  "terugbelverzoek-chat": "Bedankt voor je terugbelverzoek via onze chat. Een collega belt je zo snel mogelijk, uiterlijk binnen één werkdag.",
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
    const { type, leadId, reference, fields } = parsed.data;
    // Interne waarschuwing alleen van vertrouwde aanroepers (wordt hieronder gecontroleerd).
    let { recipientEmail, userEmail } = parsed.data;

    // ── Toegang: intern (x-internal-secret), ingelogd teamlid, of publiek (strikt) ──
    const isTrusted = await isTrustedCaller(req);
    // Klantsamenvatting + replyTo komen bij publiek uit de database.
    let customerFields: Record<string, unknown> = fields;
    let replyToEmail: string | undefined = (fields.email as string) || undefined;
    if (!isTrusted) {
      const spec = PUBLIC_TYPE_TABLE[type];
      if (!spec) return jsonRes({ error: "unknown_type" }, 400);
      if (!leadId) return jsonRes({ error: "lead_id_required" }, 400);
      const { data: rec } = await supabase.from(spec.table).select("*").eq("id", leadId).maybeSingle();
      if (!rec) return jsonRes({ error: "not_found" }, 404);
      const createdAt = new Date((rec as any)[spec.createdCol]).getTime();
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > PUBLIC_MAX_AGE_MS) {
        return jsonRes({ error: "too_old" }, 403);
      }
      const { data: already } = await supabase.from("lead_notification_log")
        .select("id").eq("lead_type", type).eq("lead_id", leadId).eq("status", "sent")
        .limit(1).maybeSingle();
      if (already) return jsonRes({ success: true, skipped: "already_sent" }, 200);
      recipientEmail = undefined; // altijd info@
      const dbEmail = String((rec as any).email ?? "").trim();
      userEmail = dbEmail || null;
      replyToEmail = dbEmail || undefined;
      customerFields = customerFieldsFromRecord(spec.table, rec as Record<string, unknown>);
    }
    // Centrale, fail-safe omgevingsdetectie (host-based, APP_ENV is secundair).
    // Zie supabase/functions/_shared/environment.ts.
    const env = resolveEnvironment(req);
    const isProd = env.isProduction;
    console.log("send-lead-notification env:", JSON.stringify(env));
    console.log(`[mail] ${JSON.stringify({ function: "send-lead-notification", environment: isProd ? "production" : "preview", env_reason: env.reason, host_source: env.hostSource, app_env: env.appEnv })}`);

    // Interne mail: volledige veldenlijst uit het leadrecord (e-mail en telefoon bovenaan).
    let internFields: Record<string, unknown> = fields;
    let isTestLead = false;
    if (leadId) {
      const { data: leadRec } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      if (leadRec) {
        isTestLead = (leadRec as any).is_test === true;
        const { velden, bericht } = interneMailVelden(leadRec as Record<string, unknown>);
        internFields = Object.fromEntries(velden);
        if (bericht) internFields["Bericht"] = bericht;
        // Extra context van vertrouwde aanroepers (bijv. chatsamenvatting, premie) behouden.
        if (isTrusted) for (const [k, v] of Object.entries(fields)) {
          if (["samenvatting_chat", "premie", "dekking"].includes(k) && v) internFields[prettyLabel(k)] = v;
        }
      }
    }

    const label = LEAD_LABELS[type] || type;
    const subjBase = (SUBJECTS[type] || ((r: string) => `Nieuwe lead (${type}) via zpzaken.nl - ${r}`))(reference || leadId || "");
    const subject = `${isTestLead ? "[TEST] " : ""}${isProd ? subjBase : `[PREVIEW] ${subjBase}`}`;

    // Deeplinks in teammails altijd naar het productiedomein (live sinds 1-10-2026).
    const adminBase = isProd ? "https://zpzaken.nl" : (Deno.env.get("ADMIN_BASE_URL") || "https://zpzaken.nl").replace(/\/$/, "");
    const deeplink = leadId ? `${adminBase}/admin/leads/${leadId}` : null;

    const waarschuwing = isTrusted ? parsed.data.waarschuwing : undefined;
    const html = renderHtml(label, internFields, leadId, deeplink, waarschuwing);
    const text = (waarschuwing ? `${waarschuwing}\n\n` : "") + renderText(label, internFields) + (deeplink ? `\nOpen in admin: ${deeplink}\n` : "");

    try {
      const internalResults = await verstuurInterneMelding(supabase, req, "send-lead-notification", {
        leadType: type, leadId, subject, html, text,
        replyTo: isProd ? replyToEmail : undefined,
        metadata: fields,
      });

      // Klantbevestigingsmail (alleen als userEmail aanwezig)
      const customerEmailRaw = (isTrusted ? (userEmail || (fields.email as string | undefined) || "") : (userEmail || "")).trim();
      // Testleads krijgen nooit een klantbevestiging.
      if (customerEmailRaw && resend && !isTestLead) {
        const customerRecipient = isProd ? customerEmailRaw : "boy.kruiswijk@zpzaken.nl";
        const customerSubjBase = `Bevestiging van je aanvraag bij ZP Zaken`;
        const customerSubject = isProd ? customerSubjBase : `[PREVIEW] ${customerSubjBase} (origineel naar ${customerEmailRaw})`;
        try {
          const custRes: any = await resend.emails.send({
            from: getFromAddress(),
            to: [customerRecipient],
            replyTo: "info@zpzaken.nl",
            subject: customerSubject,
            html: renderCustomerHtml(type, label, customerFields),
            text: renderCustomerText(type, customerFields),
          });
          await supabase.from("lead_notification_log").insert({
            lead_type: type, lead_id: leadId ?? null, recipient: customerRecipient, cc: null,
            subject: customerSubject,
            status: custRes?.error ? "failed" : "sent",
            error_message: custRes?.error ? `${custRes.error.name ?? "resend"}: ${custRes.error.message ?? ""}` : null,
            resend_message_id: custRes?.data?.id ?? null,
            metadata: { ...fields, customer_confirmation: true },
          });
        } catch (custErr) {
          const cmsg = custErr instanceof Error ? custErr.message : String(custErr);
          console.error("Customer confirmation send error", cmsg);
          await supabase.from("lead_notification_log").insert({
            lead_type: type, lead_id: leadId ?? null, recipient: customerRecipient, cc: null,
            subject: customerSubject, status: "failed", error_message: cmsg,
            metadata: { ...fields, customer_confirmation: true },
          });
        }
      }

      return new Response(JSON.stringify({ success: internalResults.every((result) => result.ok) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (mailErr) {
      const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error("Resend error", msg);
      await supabase.from("lead_notification_log").insert({
        lead_type: type, lead_id: leadId ?? null, recipient: "interne-ontvangers", cc: userEmail ?? null,
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
