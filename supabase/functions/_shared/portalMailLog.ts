// Mijn ZP-mails (uitnodiging, inloglink) per klant met actuele afleverstatus bij Resend. Alleen lezen.
// deno-lint-ignore-file no-explicit-any

/** Plaatsaanduidingen zoals "-" of "- -" uit importbestanden zijn geen naam. */
export function echteNaam(n: unknown): string | null {
  const t = String(n ?? "").trim();
  return !t || /^[-.\s]+$/.test(t) ? null : t;
}

export const PORTAL_MAIL_TYPES = ["portal_invite", "portal_login"] as const;

const STATUS_NL: Record<string, string> = {
  delivered: "afgeleverd", sent: "verstuurd", queued: "in wachtrij", scheduled: "ingepland",
  bounced: "geweigerd door ontvanger", complained: "als spam gemeld", delivery_delayed: "vertraagd",
  opened: "geopend", clicked: "aangeklikt", failed: "mislukt", canceled: "geannuleerd",
};
export const afleverLabel = (e: string | null | undefined) => (e ? STATUS_NL[e] ?? e : "onbekend");

export async function resendStatus(id: string, key: string, f: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await f(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return typeof j?.last_event === "string" ? j.last_event : null;
  } catch { return null; }
}

export async function portalMailLog(admin: any, adressen: string[], f: typeof fetch = fetch) {
  if (!adressen.length) return [];
  const key = (globalThis as any).Deno?.env?.get("RESEND_API_KEY") ?? "";
  const { data } = await admin.from("lead_notification_log")
    .select("created_at, lead_type, recipient, subject, status, error_message, resend_message_id")
    .in("lead_type", PORTAL_MAIL_TYPES as unknown as string[])
    .in("recipient", adressen).order("created_at", { ascending: false }).limit(10);
  return Promise.all(((data ?? []) as any[]).map(async (r) => {
    const event = r.status === "sent" && r.resend_message_id && key ? await resendStatus(r.resend_message_id, key, f) : null;
    return {
      op: r.created_at, soort: r.lead_type === "portal_invite" ? "uitnodiging" : "inloglink", aan: r.recipient, onderwerp: r.subject,
      verzonden: r.status === "sent", fout: r.error_message ?? null,
      aflevering: r.status === "sent" ? afleverLabel(event) : "niet verstuurd",
    };
  }));
}
