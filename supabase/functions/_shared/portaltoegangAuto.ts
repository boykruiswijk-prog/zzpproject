// deno-lint-ignore-file no-explicit-any
// Automatische Mijn ZP-uitnodiging bij een portaltoegang-aanvraag.
// Alleen als het adres exact bij één contactpersoon van precies één actieve klant hoort
// (RPC portaltoegang_auto_match). Zelfde mail als de knop "Toegang verlenen".
// Geen match of twijfel: aanvraag blijft staan voor het team met een reden.
import { safeAppOrigin } from "./company.ts";
import { buildInviteHtml, ensurePortalUser, generateMagicLink, sendPortalMail } from "./portalAccess.ts";
import { echteNaam } from "./portalMailLog.ts";

export const MAX_UITNODIGINGEN_PER_24U = 3;

/** Misbruikrem: maximaal 3 portaaluitnodigingen per adres per 24 uur. */
export function binnenMisbruikrem(aantalLaatste24u: number): boolean {
  return aantalLaatste24u < MAX_UITNODIGINGEN_PER_24U;
}

export interface AutoUitkomst { aanvraag_id: string; email: string; besluit: "uitgenodigd" | "geen_match" | "mislukt" | "overgeslagen"; reden?: string | null; klant?: string | null; message_id?: string | null; user_created?: boolean; polissen_gekoppeld?: number }

async function zetReden(admin: any, aanvraag: any, besluit: string, reden: string) {
  await admin.from("klant_service_aanvragen").update({
    details: { ...(aanvraag.details ?? {}), automatisch: { besluit, reden, op: new Date().toISOString() } },
  }).eq("id", aanvraag.id);
}

export async function verwerkPortaltoegangAuto(admin: any, req: Request, aanvraagId: string, opts: { droog?: boolean; origin?: string } = {}): Promise<AutoUitkomst> {
  const { data: a } = await admin.from("klant_service_aanvragen").select("id,type,email,status,details,is_test").eq("id", aanvraagId).maybeSingle();
  const email = String(a?.email ?? "").trim().toLowerCase();
  if (!a || a.type !== "portaltoegang") return { aanvraag_id: aanvraagId, email, besluit: "overgeslagen", reden: "geen portaltoegang-aanvraag" };
  if (a.status === "afgerond") return { aanvraag_id: aanvraagId, email, besluit: "overgeslagen", reden: "al afgerond" };
  if (a.details?.toegang_verleend) return { aanvraag_id: aanvraagId, email, besluit: "overgeslagen", reden: "al uitgenodigd door het team" };
  const { data: m, error } = await admin.rpc("portaltoegang_auto_match", { _email: email });
  if (error) throw new Error(`match mislukt: ${error.message}`);
  if (!m?.match) {
    if (!opts.droog) await zetReden(admin, a, "geen_match", m?.reden ?? "onbekend");
    return { aanvraag_id: aanvraagId, email, besluit: "geen_match", reden: m?.reden ?? "onbekend" };
  }
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin.from("lead_notification_log").select("id", { count: "exact", head: true })
    .in("lead_type", ["portal_invite"]).ilike("recipient", email).eq("status", "sent").gte("created_at", since);
  if (!binnenMisbruikrem(count ?? 0)) {
    if (!opts.droog) await zetReden(admin, a, "geen_match", "misbruikrem: al 3 uitnodigingen in 24 uur");
    return { aanvraag_id: aanvraagId, email, besluit: "geen_match", reden: "misbruikrem: al 3 uitnodigingen in 24 uur", klant: m.klant };
  }
  if (opts.droog) return { aanvraag_id: aanvraagId, email, besluit: "uitgenodigd", reden: "droge run: zou uitnodigen", klant: m.klant };

  const voornaam = echteNaam(m.voornaam);
  const { userId, created } = await ensurePortalUser(admin, email, voornaam);
  const origin = opts.origin ?? safeAppOrigin(req.headers.get("origin"));
  const link = await generateMagicLink(admin, email, `${origin}/portal`);
  const res = await sendPortalMail(admin, req, "portaltoegang-auto", {
    to: email, subject: "Welkom bij Mijn ZP", html: buildInviteHtml(link, voornaam, origin),
    leadType: "portal_invite", leadId: null, metadata: { onderneming_id: m.onderneming_id, aanvraag_id: aanvraagId, automatisch: true, soort: "persoon" },
  });
  if (!res.sent) {
    await zetReden(admin, a, "mislukt", `uitnodiging niet verstuurd: ${res.error ?? "onbekend"}`);
    return { aanvraag_id: aanvraagId, email, besluit: "mislukt", reden: res.error ?? "verzenden mislukt", klant: m.klant };
  }
  const { data: v, error: vErr } = await admin.rpc("portaltoegang_auto_vastleggen", {
    _aanvraag_id: aanvraagId, _onderneming_id: m.onderneming_id, _persoon_id: m.persoon_id, _portal_user_id: userId, _user_created: created, _message_id: res.messageId ?? null,
  });
  if (vErr) throw new Error(`vastleggen mislukt (mail wel verstuurd): ${vErr.message}`);
  return { aanvraag_id: aanvraagId, email, besluit: "uitgenodigd", klant: m.klant, message_id: res.messageId ?? null, user_created: created, polissen_gekoppeld: v?.polissen_gekoppeld ?? 0 };
}
