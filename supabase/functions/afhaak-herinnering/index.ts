// A20-aanvulling 1: elke 15 minuten (cron, x-cron-secret uit Vault). Eenmalige herinnering aan
// afgehaakte aanvragen (2 tot 24 uur stil, vanaf het aanzetmoment). Selectie en claim in SQL
// (afhaak_herinnering_kandidaten/_claim). Body { dry_run: true } mailt en schrijft niets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createMailGate } from "../_shared/mail.ts";
import { geldigEmail } from "../_shared/geldigEmail.ts";
import { AFHAAK_LEAD_TYPE, AFHAAK_ONDERWERP, afhaakHtml, afhaakResendBody } from "../_shared/afhaakHerinnering.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const maskeer = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);
  const dryRun = (await req.json().catch(() => ({})))?.dry_run === true;

  const { data: cfg } = await admin.from("facturatie_config").select("herinnering_afhaak_vanaf").eq("id", 1).maybeSingle();
  if (!cfg?.herinnering_afhaak_vanaf) return json({ skipped: "uitgeschakeld" });

  const { data: kand, error } = await admin.rpc("afhaak_herinnering_kandidaten", { _limit: 25 });
  if (error) return json({ error: error.message }, 500);
  const lijst = ((kand ?? []) as { id: string; email: string; voornaam: string | null }[]).filter((k) => !!geldigEmail(k.email));
  if (dryRun) return json({ dry_run: true, kandidaten: lijst.map((k) => ({ id: k.id, email: maskeer(k.email) })) });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const gate = createMailGate("afhaak-herinnering", req);
  const res = { verstuurd: 0, mislukt: 0, overgeslagen: 0, preview: !gate.isProduction };
  for (const k of lijst) {
    const to = geldigEmail(k.email)!;
    const { data: claim } = await admin.rpc("afhaak_herinnering_claim", { _id: k.id });
    if (claim !== true) { res.overgeslagen++; continue; }
    const plan = gate.plan({ to, subject: AFHAAK_ONDERWERP, html: afhaakHtml(k.voornaam) });
    let status = "failed", messageId: string | null = null, err: string | null = null;
    if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
    else if (!RESEND_API_KEY) err = "RESEND_API_KEY ontbreekt";
    else {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify(afhaakResendBody({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html, voornaam: k.voornaam })),
        });
        const t = await resp.text();
        if (resp.ok) { status = "sent"; try { messageId = JSON.parse(t).id ?? null; } catch { /* */ } }
        else err = `Resend ${resp.status}: ${t.slice(0, 300)}`;
      } catch (e) { err = `verzendfout: ${String(e).slice(0, 200)}`; }
    }
    // Geen nieuwe poging in deze run; herinnering_verstuurd_op blijft staan, dus ook nooit een tweede mail later.
    await admin.from("lead_notification_log").insert({
      lead_type: AFHAAK_LEAD_TYPE, lead_id: null, recipient: to, subject: AFHAAK_ONDERWERP, status,
      error_message: err, resend_message_id: messageId,
      metadata: { concept_id: k.id, redirected: plan.redirected, preview: !gate.isProduction },
    });
    if (status === "sent") res.verstuurd++; else res.mislukt++;
  }
  return json({ ok: true, ...res });
});
