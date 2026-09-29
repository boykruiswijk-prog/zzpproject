// Gedeelde logica voor toegang tot Mijn ZP (klantportaal).
// - ensurePortalUser: auth-gebruiker opzoeken of (bevestigd, zonder wachtwoord) aanmaken
// - linkLeadPolicies: alle polissen van een lead aan die gebruiker koppelen
// - sendPortalLoginMail: magic link genereren en mailen (met preview-redirect en logging)
// - invitePortalLead: volledige uitnodiging voor één lead (gebruikt door invite + bulk)
// deno-lint-ignore-file no-explicit-any
import { createMailGate } from "./mail.ts";
import { safeAppOrigin } from "./company.ts";

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc("portal_user_id_by_email", { p_email: email });
  if (error) throw new Error(`gebruiker opzoeken mislukt: ${error.message}`);
  return (data as string | null) ?? null;
}

export async function ensurePortalUser(
  admin: any, email: string, fullName?: string | null,
): Promise<{ userId: string; created: boolean }> {
  const existing = await findUserIdByEmail(admin, email);
  if (existing) return { userId: existing, created: false };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !data?.user) {
    // Race: iemand anders maakte hem net aan.
    const again = await findUserIdByEmail(admin, email);
    if (again) return { userId: again, created: false };
    throw new Error(`gebruiker aanmaken mislukt: ${error?.message ?? "onbekend"}`);
  }
  return { userId: data.user.id, created: true };
}

export async function linkLeadPolicies(admin: any, leadId: string, userId: string): Promise<number> {
  // Alleen niet-gekoppelde polissen of polissen die al van deze gebruiker zijn.
  const { data, error } = await admin
    .from("policies")
    .update({ user_id: userId })
    .eq("lead_id", leadId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .select("id");
  if (error) throw new Error(`polis koppelen mislukt: ${error.message}`);
  return data?.length ?? 0;
}

export async function generateMagicLink(admin: any, email: string, redirectTo: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", email, options: { redirectTo },
  });
  const link = data?.properties?.action_link;
  if (error || !link) throw new Error(`magic link maken mislukt: ${error?.message ?? "geen link"}`);
  return link;
}

function shell(inner: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#ffffff">
    ${inner}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888;margin:0">ZP Zaken B.V. | info@zpzaken.nl | 020 - 457 3077</p>
  </div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0">
      <a href="${escapeHtml(url)}" style="background:#E53E2F;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(label)}</a>
    </p>
    <p style="font-size:13px;color:#555;margin:0 0 8px">Werkt de knop niet? Kopieer dan deze link in je browser:</p>
    <p style="font-size:12px;color:#666;word-break:break-all;margin:0 0 16px">${escapeHtml(url)}</p>`;
}

export function buildInviteHtml(actionUrl: string, voornaam: string | null | undefined, origin: string): string {
  const aanhef = voornaam && voornaam.trim() ? `Beste ${escapeHtml(voornaam.trim())},` : "Beste klant,";
  const loginUrl = `${origin.replace(/^https?:\/\//, "")}/portal/login`;
  return shell(`
    <h2 style="color:#E53E2F;margin:0 0 16px;font-size:20px">Welkom bij Mijn ZP</h2>
    <p style="margin:0 0 16px;line-height:1.5">${aanhef}</p>
    <p style="margin:0 0 16px;line-height:1.5">Mijn ZP is jouw persoonlijke omgeving bij ZP Zaken. Je kunt er:</p>
    <ul style="margin:0 0 16px;padding-left:20px;line-height:1.6">
      <li>je verzekeringscertificaat downloaden;</li>
      <li>je facturen bekijken;</li>
      <li>je polis pauzeren of opzeggen.</li>
    </ul>
    <p style="margin:0 0 8px;line-height:1.5">Met de knop hieronder ben je in één klik ingelogd. Een wachtwoord is niet nodig.</p>
    ${button(actionUrl, "Inloggen bij Mijn ZP")}
    <p style="font-size:13px;color:#555;line-height:1.5;margin:0">
      De link is 24 uur geldig en werkt één keer. Daarna vraag je eenvoudig een nieuwe inloglink aan via
      <a href="https://${escapeHtml(loginUrl)}" style="color:#E53E2F">${escapeHtml(loginUrl)}</a>.
    </p>`);
}

export function buildLoginHtml(actionUrl: string): string {
  return shell(`
    <h2 style="color:#E53E2F;margin:0 0 16px;font-size:20px">Inloggen bij Mijn ZP</h2>
    <p style="margin:0 0 16px;line-height:1.5">Beste klant,</p>
    <p style="margin:0 0 16px;line-height:1.5">Je hebt een inloglink aangevraagd voor Mijn ZP. Klik op de knop om direct ingelogd te worden. De link werkt één keer.</p>
    ${button(actionUrl, "Inloggen bij Mijn ZP")}
    <p style="font-size:13px;color:#555;line-height:1.5;margin:0">Heb je geen inloglink aangevraagd? Dan kun je deze e-mail negeren.</p>`);
}

export interface SendResult { sent: boolean; messageId?: string; error?: string; recipient: string }

/** Verstuurt één mail via Resend met de centrale preview-gate en logt in lead_notification_log. */
export async function sendPortalMail(
  admin: any, req: Request, fnName: string,
  opts: { to: string; subject: string; html: string; leadType: string; leadId: string | null; metadata?: Record<string, unknown> },
): Promise<SendResult> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const gate = createMailGate(fnName, req);
  const plan = gate.plan({ to: opts.to, subject: opts.subject, html: opts.html });
  let result: SendResult = { sent: false, recipient: plan.to.join(", ") || opts.to };

  if (!plan.send) {
    result.error = plan.reason ?? "niet_verzonden";
  } else if (!RESEND_API_KEY) {
    result.error = "RESEND_API_KEY ontbreekt";
  } else {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      result = { sent: true, messageId: j?.id, recipient: plan.to.join(", ") };
    } else {
      result.error = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
    }
  }

  await admin.from("lead_notification_log").insert({
    lead_type: opts.leadType,
    lead_id: opts.leadId,
    recipient: result.recipient,
    subject: plan.subject,
    status: result.sent ? "sent" : "failed",
    error_message: result.error ?? null,
    resend_message_id: result.messageId ?? null,
    metadata: { ...(opts.metadata ?? {}), redirected: plan.redirected, original_to: plan.originalTo },
  });
  return result;
}

export interface InviteOutcome {
  lead_id: string;
  ok: boolean;
  user_created?: boolean;
  policies_linked?: number;
  mail_sent?: boolean;
  error?: string;
}

/** Volledige uitnodiging voor één lead: gebruiker, koppeling, uitnodigingsrecord en mail. */
export async function invitePortalLead(
  admin: any, req: Request, leadId: string, invitedBy: string | null, fnName = "send-portal-invite",
): Promise<InviteOutcome> {
  const { data: lead, error } = await admin
    .from("leads").select("id, email, voornaam, achternaam").eq("id", leadId).maybeSingle();
  if (error) return { lead_id: leadId, ok: false, error: error.message };
  if (!lead) return { lead_id: leadId, ok: false, error: "lead_niet_gevonden" };
  const email = String(lead.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { lead_id: leadId, ok: false, error: "geen_geldig_email" };

  const { count } = await admin.from("policies").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
  if (!count) return { lead_id: leadId, ok: false, error: "geen_polis" };

  const fullName = [lead.voornaam, lead.achternaam].filter(Boolean).join(" ").trim() || null;
  const { userId, created } = await ensurePortalUser(admin, email, fullName);
  const linked = await linkLeadPolicies(admin, leadId, userId);

  await admin.from("portal_invitations").insert({
    email, lead_id: leadId, invited_by: invitedBy, user_id: userId, status: "pending",
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });

  const origin = safeAppOrigin(req.headers.get("origin"));
  const link = await generateMagicLink(admin, email, `${origin}/portal`);
  const mail = await sendPortalMail(admin, req, fnName, {
    to: email,
    subject: "Welkom bij Mijn ZP – je persoonlijke klantomgeving",
    html: buildInviteHtml(link, lead.voornaam, origin),
    leadType: "portal_invite",
    leadId,
    metadata: { user_created: created, policies_linked: linked },
  });

  return { lead_id: leadId, ok: mail.sent, user_created: created, policies_linked: linked, mail_sent: mail.sent, error: mail.error };
}
