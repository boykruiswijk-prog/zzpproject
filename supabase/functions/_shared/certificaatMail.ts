import { createMailGate } from "./mail.ts";
import { COMPANY } from "./company.ts";

// Shared by new applications and later cyber: identical template and attachment route.
// deno-lint-ignore-file no-explicit-any
export async function mailCertificaat(admin: any, req: Request, policy: any, user: { id: string }, options: { dryRun?: boolean; idempotencyKey?: string } = {}) {
  if (!policy.pdf_url) return { ok: false as const, error: "Geen PDF beschikbaar", status: "mail_mislukt" };
  const { data: lead } = policy.lead_id
    ? await admin.from("leads").select("email,voornaam").eq("id", policy.lead_id).maybeSingle()
    : { data: null };
  let email = lead?.email?.trim();
  let voornaam = lead?.voornaam;
  if (!email && policy.onderneming_id) {
    const { data: po } = await admin.from("persoon_onderneming").select("personen(voornaam,email_weergave)").eq("onderneming_id", policy.onderneming_id);
    const p = (po || []).map((x: any) => x.personen).find((x: any) => x?.email_weergave);
    email = p?.email_weergave?.trim(); voornaam = p?.voornaam;
  }
  if (!email) return { ok: false as const, error: "Geen e-mailadres bij deze lead/klant", status: "mail_mislukt" };
  const key = (globalThis as any).Deno?.env.get("RESEND_API_KEY");
  if (!key) return { ok: false as const, error: "Mailinstelling ontbreekt", status: "mail_mislukt" };
  const subject = `Je certificaat ${policy.certificate_number} – ZP Zaken`;
  const html = `<p>Beste ${voornaam || "klant"},</p><p>In de bijlage vind je je certificaat ${policy.certificate_number} voor je beroeps- en bedrijfsaansprakelijkheidsverzekering.</p><p>Met vriendelijke groet,<br/>ZP Zaken<br/>${COMPANY.phoneDisplay} · ${COMPANY.email}</p>`;
  const plan = createMailGate("generate-certificate", req).plan({ to: email, subject, html });
  if (options.dryRun) return { ok: plan.send, status: plan.send ? "zou_verzenden" : "niet_verzonden_gate" };
  const log = (status: string, extra: Record<string, unknown>) => admin.from("lead_notification_log").insert({
    lead_type: "certificaat", lead_id: policy.lead_id, recipient: email, subject, status,
    metadata: { soort: "certificaat_handmatig", certificate_number: policy.certificate_number, door: user.id, preview: !plan.send ? undefined : plan.to?.join(",") !== email }, ...extra,
  });
  if (!plan.send) { await log("failed", { error_message: `niet verzonden: ${plan.reason}` }); return { ok: false as const, error: `Niet verzonden: ${plan.reason}`, status: "mail_mislukt" }; }
  const { data: file, error } = await admin.storage.from("certificates").download(policy.pdf_url);
  if (error || !file) return { ok: false as const, error: "PDF niet gevonden", status: "mail_mislukt" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let b64 = "";
  for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
      body: JSON.stringify({ from: plan.from, to: plan.to, bcc: plan.bcc, subject: plan.subject, html: plan.html, attachments: [{ filename: `${policy.certificate_number}.pdf`, content: btoa(b64) }] }),
    });
    const rb = await res.json().catch(() => ({}));
    if (!res.ok) { await log("failed", { error_message: `Resend ${res.status}` }); return { ok: false as const, error: "Verzenden mislukt", status: res.status >= 500 || res.status === 408 ? "mail_onzeker" : "mail_mislukt" }; }
    await log("sent", { resend_message_id: rb?.id ?? null });
    const naar = (plan.to || []).join(", ");
    return { ok: true as const, status: "verzonden", to: naar, opmerking: naar !== email ? "Preview: alleen naar het team verstuurd" : null };
  } catch {
    return { ok: false as const, error: "Verzending niet bevestigd", status: "mail_onzeker" };
  }
}