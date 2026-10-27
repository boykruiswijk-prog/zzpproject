// NPS-verzoek (A22-aanvulling NPS): eenmaal per klant, 30 dagen na activatie, werkdagen.
// Alleen x-cron-secret (Vault). Schakelaar facturatie_config.nps_actief (standaard UIT).
// Body { dry_run: true } geeft alleen kandidaten terug; schrijft en mailt niets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createMailGate } from "../_shared/mail.ts";
import { NPS_ONDERWERP, npsHtml } from "../_shared/npsMail.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const maskeer = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");
const nlWeekdag = () => new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(new Date());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);
  const dryRun = (await req.json().catch(() => ({})))?.dry_run === true;

  const { data: cfg } = await admin.from("facturatie_config").select("nps_actief").eq("id", 1).maybeSingle();
  if (cfg?.nps_actief !== true) return json({ skipped: "uitgeschakeld" });
  const dag = nlWeekdag();
  if (!dryRun && (dag === "Sat" || dag === "Sun")) return json({ skipped: "weekend" });

  const { data: kand, error } = await admin.rpc("nps_kandidaten", { _limit: 50 });
  if (error) return json({ error: error.message }, 500);
  if (dryRun) return json({ dry_run: true, kandidaten: (kand ?? []).map((r: any) => ({ lead_id: r.lead_id, email: maskeer(r.email) })) });

  const gate = createMailGate("nps-verzoeken", req);
  const res = { verstuurd: 0, mislukt: 0, preview: !gate.isProduction };
  for (const r of (kand ?? []) as any[]) {
    // Rij eerst (unique lead_id): een klant krijgt nooit twee verzoeken, ook niet na een fout.
    const { data: rij, error: e } = await admin.from("nps_antwoorden")
      .insert({ lead_id: r.lead_id, onderneming_id: r.onderneming_id, email: r.email, status: "klaargezet" }).select("id, token").single();
    if (e || !rij) { res.mislukt++; continue; }
    const email = r.email.toLowerCase();
    let afmeld = (await admin.from("email_unsubscribe_tokens").select("token").eq("email", email).is("used_at", null).limit(1).maybeSingle()).data?.token;
    if (!afmeld) {
      afmeld = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await admin.from("email_unsubscribe_tokens").insert({ email, token: afmeld });
    }
    const html = npsHtml({ voornaam: r.voornaam, token: rij.token, paginaUrl: "https://zpzaken.nl/nps", afmeldUrl: `https://zpzaken.nl/afmelden?token=${afmeld}` });
    const plan = gate.plan({ to: r.email, subject: NPS_ONDERWERP, html });
    let status = "failed", messageId: string | null = null, err: string | null = null;
    if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
    else if (!RESEND_API_KEY) err = "RESEND_API_KEY ontbreekt";
    else {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: plan.from, to: plan.to, reply_to: "info@zpzaken.nl", subject: plan.subject, html: plan.html }),
      });
      const t = await resp.text();
      if (resp.ok) { status = "sent"; try { messageId = JSON.parse(t).id ?? null; } catch { /* */ } }
      else err = `Resend ${resp.status}: ${t.slice(0, 300)}`;
    }
    await admin.from("email_send_log").insert({
      template_name: "nps_verzoek", recipient_email: r.email, status, message_id: messageId, error_message: err,
      metadata: { lead_id: r.lead_id, redirected: plan.redirected, preview: !gate.isProduction },
    });
    await admin.from("nps_antwoorden").update(status === "sent" ? { status: "verstuurd", verstuurd_op: new Date().toISOString() } : { status: "overgeslagen" }).eq("id", rij.id);
    status === "sent" ? res.verstuurd++ : res.mislukt++;
  }
  return json({ ok: true, ...res });
});
