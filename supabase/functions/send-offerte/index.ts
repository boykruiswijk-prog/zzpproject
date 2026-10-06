// Offerte versturen voor een offerteaanvraag (lead). Modus "voorbeeld" geeft alleen de mail terug;
// modus "versturen" verstuurt via de gedeelde mailroute, logt in email_send_log en zet pas na een
// geslaagde verzending de status op offerte_verstuurd, met notitie. Testleads alleen naar @zpzaken.nl.
// Toegang: teamlid (JWT) of cron-secret met uitgevoerd_door (teamlid), voor een eenmalige beheeractie.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createMailGate } from "../_shared/mail.ts";
import { COMPANY } from "../_shared/company.ts";
import { OFFERTE, offerteHtml } from "../_shared/offerte.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  let uid: string | null = null;
  const secret = req.headers.get("x-cron-secret");
  if (secret) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { p_secret: secret });
    if (ok !== true) return json({ error: "unauthorized" }, 401);
    uid = typeof body.uitgevoerd_door === "string" ? body.uitgevoerd_door : null;
  } else {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    uid = (await userClient.auth.getUser()).data.user?.id ?? null;
  }
  if (!uid) return json({ error: "unauthorized" }, 401);
  const { data: team } = await admin.rpc("is_team_member", { _user_id: uid });
  if (team !== true) return json({ error: "forbidden" }, 403);
  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", uid).maybeSingle();
  const naamTeamlid = prof?.full_name ?? "teamlid";

  const { lead_id, modus, engels } = body as { lead_id?: string; modus?: string; engels?: boolean };
  if (typeof lead_id !== "string") return json({ error: "lead_id ontbreekt" }, 400);
  const { data: lead } = await admin.from("leads").select("id,type,status,voornaam,achternaam,email,bedrijfsnaam,is_test,extra_data,offerte_verstuurd_op").eq("id", lead_id).maybeSingle();
  if (!lead) return json({ error: "lead niet gevonden" }, 404);
  if (lead.type !== "offerte-aanvraag") return json({ error: "alleen voor offerteaanvragen" }, 400);
  const sector = String((lead.extra_data as any)?.sector ?? "");
  const mail = offerteHtml({ voornaam: lead.voornaam ?? "", bedrijfsnaam: lead.bedrijfsnaam ?? "", sector, engels: engels === true });
  const subject = `Je offerte van ZP Zaken${lead.bedrijfsnaam ? ` voor ${lead.bedrijfsnaam}` : ""}`;
  if (modus !== "versturen") return json({ ok: true, voorbeeld: true, aan: lead.email, onderwerp: subject, html: mail, al_verstuurd_op: lead.offerte_verstuurd_op });

  const to = String(lead.email ?? "").trim().toLowerCase();
  if (!to) return json({ error: "geen e-mailadres" }, 400);
  if (lead.is_test && !to.endsWith("@zpzaken.nl")) return json({ error: "testlead: alleen @zpzaken.nl" }, 400);
  const gate = createMailGate("send-offerte", req);
  const plan = gate.plan({ to, subject, html: mail });
  const key = Deno.env.get("RESEND_API_KEY");
  let status = "failed", err: string | null = null, mid: string | null = null;
  if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
  else if (!key) err = "RESEND_API_KEY ontbreekt";
  else {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: plan.from, to: plan.to, reply_to: COMPANY.email, subject: plan.subject, html: plan.html }) });
    const t = await r.text();
    if (r.ok) { status = "sent"; try { mid = JSON.parse(t).id ?? null; } catch { /* */ } } else err = `Resend ${r.status}`;
  }
  await admin.from("email_send_log").insert({ template_name: "offerte", recipient_email: to, status, message_id: mid, error_message: err,
    metadata: { lead_id, redirected: plan.redirected, preview: !gate.isProduction, engels: engels === true, uitgevoerd_door: uid, pakket: OFFERTE.pakket } });
  if (status !== "sent") return json({ error: err ?? status }, 502);
  // Alleen in productie (echte ontvanger) de status zetten; een preview-mail is geen echte verzending.
  if (gate.isProduction) {
    await admin.from("leads").update({ status: "offerte_verstuurd", offerte_verstuurd_op: new Date().toISOString() }).eq("id", lead_id);
    await admin.from("lead_notes").insert({ lead_id, user_id: uid, type: "notitie",
      content: `Offerte verstuurd aan ${to} door ${naamTeamlid}: BAV ${OFFERTE.bav} en AVB ${OFFERTE.avb} per gebeurtenis via ${OFFERTE.verzekeraar}, ${OFFERTE.maand} of ${OFFERTE.jaar}${engels ? ", met Engelse inleiding" : ""}.` });
    await admin.from("activiteiten_log").insert({ actie_type: "offerte_verstuurd", omschrijving: `Offerte verstuurd aan ${to}`, uitgevoerd_door: uid, uitgevoerd_door_naam: naamTeamlid, lead_id, klant_email: to, is_test: lead.is_test });
  }
  return json({ ok: true, productie: gate.isProduction, aan: plan.to });
});
