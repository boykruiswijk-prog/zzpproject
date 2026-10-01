// Polis-lifecycle mails: versturen + altijd één regel in lead_notification_log.
// Pure helper (geen Deno-imports) zodat hij met een gemockte verzender te testen is.

export type LifecycleActie = "pauzeren" | "hervatten" | "opzeggen" | "heractiveren";
export type Doelgroep = "klant" | "intern" | "onefellow";

export interface MailResultaat {
  ok: boolean; status?: number; message_id?: string; error?: string;
  to?: string[] | string; redirected?: boolean;
}

export interface LifecycleMailDeps {
  send: (to: string, subject: string, html: string) => Promise<MailResultaat>;
  // deno-lint-ignore no-explicit-any
  insertLog: (row: Record<string, any>) => PromiseLike<unknown>;
}

export const lifecycleLeadType = (actie: LifecycleActie, doel: Doelgroep) => `polis-${actie}-${doel}`;

export async function verstuurLifecycleMail(
  deps: LifecycleMailDeps,
  p: { actie: LifecycleActie; doel: Doelgroep; leadId: string; to: string; subject: string; html: string },
): Promise<MailResultaat> {
  let res: MailResultaat;
  try { res = await deps.send(p.to, p.subject, p.html); }
  catch (e) { res = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  try {
    await deps.insertLog({
      lead_type: lifecycleLeadType(p.actie, p.doel),
      lead_id: p.leadId,
      recipient: p.to,
      subject: p.subject,
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? null : (res.error ?? "onbekende fout"),
      resend_message_id: res.message_id ?? null,
      metadata: { actie: p.actie, doelgroep: p.doel, redirected: res.redirected ?? false, verzonden_naar: res.to ?? null },
    });
  } catch (e) { console.error("lead_notification_log insert mislukt", e); }
  return res;
}

// B7 (privacy): Onefellow cross-sell alleen bij schakelaar AAN én reden "geen opdracht(en)".
// Reden wordt genormaliseerd (trim, lowercase, _ → spatie) zodat "geen opdracht " en
// "geen_opdrachten" beide herkend worden.
export function isGeenOpdrachtReden(reden: string | null | undefined): boolean {
  const n = String(reden ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  return n === "geen opdracht" || n === "geen opdrachten";
}
export const ONEFELLOW_SWITCH = "onefellow_crosssell";
export function magOnefellowMailen(switchAan: boolean, reden: string | null | undefined): boolean {
  return switchAan === true && isGeenOpdrachtReden(reden);
}
