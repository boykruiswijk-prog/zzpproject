// K5 — alarmmail bij een niet-werkende Exact-koppeling. Max. één per 24 uur,
// begrensd via exact_sync_log (trigger_type "exact_alarm", status "sent").
import { createMailGate } from "./mail.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export const ALARM_RECIPIENTS = ["info@zpzaken.nl", "boy.kruiswijk@zpzaken.nl"];
export const ALARM_SUBJECT = "[ACTIE] Exact-koppeling werkt niet";
export const ALARM_INSTRUCTIE =
  "Koppel opnieuw via Beheer → Exact-koppeling, met administratie ZP Zaken B.V. (4401707) actief in Exact.";
const WINDOW_MS = 24 * 60 * 60 * 1000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Verwijdert tokens/lange geheime strings uit een foutmelding. */
export function sanitizeError(msg: string): string {
  return msg
    .replace(/(access_token|refresh_token|client_secret)"?\s*[:=]\s*"?[^",\s}]+/gi, "$1=[redacted]")
    .replace(/[A-Za-z0-9_\-\.]{40,}/g, "[redacted]")
    .slice(0, 500);
}

export function buildAlarmMail(melding: string, bron: string, test = false) {
  const m = sanitizeError(melding);
  const subject = (test ? "[TEST] " : "") + ALARM_SUBJECT;
  const html = `<p>De koppeling tussen de website en Exact Online werkt niet.</p>
<p><strong>Melding:</strong> ${esc(m)}</p>
<p><strong>Gesignaleerd door:</strong> ${esc(bron)} op ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC</p>
<p>Zolang dit niet is opgelost gaan facturen en machtigingen niet naar Exact.</p>
<p><strong>Wat te doen:</strong> ${esc(ALARM_INSTRUCTIE)}</p>`;
  return { to: ALARM_RECIPIENTS, subject, html };
}

/** Normaliseert wisselende nummers/datums zodat dezelfde fout één throttle-sleutel houdt. */
export function normalizeAlarmError(msg: string): string {
  return sanitizeError(msg)
    .toLowerCase()
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?z?)?\b/g, "[date]")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, "[number]")
    .replace(/\s+/g, " ")
    .trim();
}

/** true als dezelfde genormaliseerde fout in het afgelopen etmaal al is verstuurd. */
export async function alarmRecentlySent(supabase: Sb, melding: string, now = Date.now()): Promise<boolean> {
  const since = new Date(now - WINDOW_MS).toISOString();
  const { data } = await supabase.from("exact_sync_log")
    .select("error_message")
    .eq("trigger_type", "exact_alarm").eq("status", "sent").gte("created_at", since);
  const key = normalizeAlarmError(melding);
  return (data ?? []).some((row: { error_message?: string | null }) => normalizeAlarmError(row.error_message ?? "") === key);
}

/** Verstuurt de alarmmail (tenzij al verstuurd in 24 u). Gooit nooit. */
export async function sendExactAlarm(
  supabase: Sb, melding: string, bron: string, req: Request | null,
): Promise<"sent" | "throttled" | "failed"> {
  try {
    if (await alarmRecentlySent(supabase, melding)) return "throttled";
    const mail = buildAlarmMail(melding, bron);
    const gate = createMailGate(`exact-alarm:${bron}`, req);
    const plan = gate.plan(mail);
    const runtime = globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } };
    const key = runtime.Deno?.env.get("RESEND_API_KEY") ?? "";
    let ok = false;
    if (plan.send && key) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html }),
      });
      ok = r.ok;
      if (!r.ok) console.error("exact-alarm: Resend", r.status);
    }
    await supabase.from("exact_sync_log").insert({
      trigger_type: "exact_alarm", status: ok ? "sent" : "error",
      error_message: sanitizeError(melding),
       payload: { bron, to: plan.to ?? [], alarm_key: normalizeAlarmError(melding) },
    });
    return ok ? "sent" : "failed";
  } catch (e) {
    console.error("exact-alarm failed", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}
