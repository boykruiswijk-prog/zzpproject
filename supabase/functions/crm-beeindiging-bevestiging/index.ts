// Bevestiging van een handmatige beeindiging aan de klant. Alleen op expliciet verzoek
// (vinkje in het beheer, standaard uit). Inhoud komt volledig uit de database.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createMailGate } from "../_shared/mail.ts";
import { COMPANY } from "../_shared/company.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nl = (d: string) => { const [y, m, dd] = d.split("-"); return `${dd}-${m}-${y}`; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: mag } = await userClient.rpc("mag_crm_beeindigen", { _uid: (await userClient.auth.getUser()).data.user?.id });
  if (mag !== true) return json({ error: "forbidden" }, 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { notitie_id } = await req.json().catch(() => ({}));
  if (typeof notitie_id !== "string") return json({ error: "notitie_id ontbreekt" }, 400);
  const { data: n } = await admin.from("crm_notities").select("id,soort,onderneming_id,details,is_test,ingetrokken_op").eq("id", notitie_id).maybeSingle();
  if (!n || n.soort !== "stop" || n.ingetrokken_op) return json({ error: "geen beeindiging" }, 400);
  if (n.details?.bevestiging_verstuurd_op) return json({ error: "al verstuurd" }, 409);
  const { data: o } = await admin.from("ondernemingen").select("naam").eq("id", n.onderneming_id).maybeSingle();
  const { data: po } = await admin.from("persoon_onderneming").select("personen(email_weergave,voornaam)").eq("onderneming_id", n.onderneming_id);
  const ontv = ((po ?? []) as any[]).map((x) => x.personen).filter((p) => p?.email_weergave);
  if (!ontv.length) return json({ error: "geen e-mailadres bekend" }, 400);
  // Testrecords nooit naar een extern adres.
  const to = ontv.map((p) => p.email_weergave as string).filter((e) => !n.is_test || e.toLowerCase().endsWith("@zpzaken.nl"));
  if (!to.length) return json({ error: "testrecord: alleen @zpzaken.nl" }, 400);
  const voornaam = ontv[0].voornaam ? `Hoi ${esc(ontv[0].voornaam)},` : "Hoi,";
  const datum = n.details?.einddatum ? nl(String(n.details.einddatum)) : "";
  const subject = `Bevestiging beeindiging ${o?.naam ?? ""}`.trim();
  const html = `<!doctype html><html lang="nl"><body style="font-family:Arial,sans-serif;color:#1a1a1a"><div style="max-width:560px;margin:0 auto;padding:24px;font-size:15px;line-height:1.6">
<p style="font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken</p><p>${voornaam}</p>
<p>Hierbij bevestigen we dat je verzekering of lidmaatschap voor ${esc(o?.naam ?? "je onderneming")} is beeindigd per ${datum}.</p>
<p>Is er na die datum al iets gefactureerd, dan ontvang je daarvoor een creditnota. Klopt er iets niet? Antwoord dan op deze mail.</p>
<p>Groet,<br>${esc(COMPANY?.naam ?? "ZP Zaken")}</p></div></body></html>`;
  const gate = createMailGate("crm-beeindiging-bevestiging", req);
  const plan = gate.plan({ to, subject, html });
  const key = Deno.env.get("RESEND_API_KEY");
  let status = "failed", err: string | null = null, mid: string | null = null;
  if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
  else if (!key) err = "RESEND_API_KEY ontbreekt";
  else {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: plan.from, to: plan.to, reply_to: "info@zpzaken.nl", subject: plan.subject, html: plan.html }) });
    const t = await r.text();
    if (r.ok) { status = "sent"; try { mid = JSON.parse(t).id ?? null; } catch { /* */ } } else err = `Resend ${r.status}`;
  }
  await admin.from("email_send_log").insert({ template_name: "crm_beeindiging_bevestiging", recipient_email: to.join(", "), status, message_id: mid, error_message: err,
    metadata: { notitie_id, redirected: plan.redirected, preview: !gate.isProduction } });
  if (status === "sent") await admin.from("crm_notities").update({ details: { ...n.details, bevestiging_verstuurd_op: new Date().toISOString(), bevestiging_aan: to } }).eq("id", notitie_id);
  return status === "sent" ? json({ ok: true }) : json({ error: err ?? status }, 502);
});
