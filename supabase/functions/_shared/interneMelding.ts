import { createMailGate } from "./mail.ts";

// deno-lint-ignore no-explicit-any
type AdminClient = any;

const BOY = "boy.kruiswijk@zpzaken.nl";
const FALLBACK = ["info@zpzaken.nl", BOY];

export type InterneMeldingInput = {
  leadType: string;
  leadId?: string | null;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  /** Meldingssoort in interne_melding_ontvangers; standaard 'algemeen'. */
  soort?: string;
};

const FALLBACK_PER_SOORT: Record<string, string[]> = { exact_boeking: ["roxy@onefellow.nl"], bav_override: [BOY] };

export async function interneOntvangers(admin: AdminClient, soort = "algemeen"): Promise<string[]> {
  const { data, error } = await admin.from("interne_melding_ontvangers")
    .select("email").eq("actief", true).eq("soort", soort).order("email");
  if (error || !data?.length) return FALLBACK_PER_SOORT[soort] ?? FALLBACK;
  return [...new Set(data.map((row: { email: string }) => row.email.trim().toLowerCase()).filter(Boolean))];
}

async function log(admin: AdminClient, input: InterneMeldingInput, recipient: string, status: "sent" | "failed", id?: string | null, error?: string | null) {
  await admin.from("lead_notification_log").insert({
    lead_type: input.leadType,
    lead_id: input.leadId ?? null,
    recipient,
    subject: input.subject,
    status,
    resend_message_id: id ?? null,
    error_message: error ?? null,
    metadata: { ...(input.metadata ?? {}), internal_notification: true, soort: input.soort ?? "algemeen" },
  });
}

async function sendOne(admin: AdminClient, req: Request | null, fnName: string, input: InterneMeldingInput, recipient: string, alarm = false) {
  const gate = createMailGate(fnName, req);
  const plan = gate.plan({ to: recipient, subject: input.subject, html: input.html });
  if (!plan.send) return { ok: true, skipped: true };
  const key = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!key) {
    await log(admin, input, recipient, "failed", null, "RESEND_API_KEY missing");
    return { ok: false, error: "email_not_configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html, text: input.text, reply_to: input.replyTo }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = `Resend ${response.status}: ${JSON.stringify(body)}`;
      await log(admin, input, recipient, "failed", null, message);
      return { ok: false, error: message };
    }
    await log(admin, input, recipient, "sent", body?.id ?? null);
    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log(admin, input, recipient, "failed", null, message);
    return { ok: false, error: message };
  }
}

export async function verstuurInterneMelding(admin: AdminClient, req: Request | null, fnName: string, input: InterneMeldingInput) {
  const recipients = await interneOntvangers(admin, input.soort ?? "algemeen");
  const results = [];
  for (const recipient of recipients) results.push({ recipient, ...(await sendOne(admin, req, fnName, input, recipient)) });
  if (results.some((result) => !result.ok)) {
    const alarmInput: InterneMeldingInput = {
      leadType: "interne-melding-alarm",
      subject: `[ALARM] Interne melding mislukt: ${input.subject}`,
      html: `<p>Minstens één interne melding is mislukt.</p><p><strong>Bron:</strong> ${fnName}</p><p><strong>Onderwerp:</strong> ${input.subject}</p>`,
      metadata: { source: fnName, original_lead_type: input.leadType },
    };
    await sendOne(admin, req, `${fnName}:alarm`, alarmInput, BOY, true);
  }
  return results;
}