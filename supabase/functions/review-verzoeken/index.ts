// Dagelijkse cron (07:15 UTC): reviewverzoek aan nieuwe klanten 2 dagen na activatie,
// plus eenmalige herinnering na 7 dagen. Alleen x-cron-secret (Vault).
// Body { dry_run: true } geeft alleen terug wie een mail zou krijgen; schrijft en mailt niets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createMailGate } from "../_shared/mail.ts";
import { isIntegratieEnabled } from "../_shared/integraties.ts";
import { reviewHtml, reviewOnderwerp, type ReviewSoort } from "../_shared/reviewMail.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

function nlWeekdag(d = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(d);
}

const maskeer = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  if (!(await isIntegratieEnabled(admin, "reviewverzoeken_actief"))) return json({ skipped: "uitgeschakeld" });
  const dag = nlWeekdag();
  if (!dryRun && (dag === "Sat" || dag === "Sun")) return json({ skipped: "weekend" });

  const [{ data: nieuw, error: e1 }, { data: herinner, error: e2 }] = await Promise.all([
    admin.rpc("review_kandidaten", { _limit: 50 }),
    admin.rpc("review_herinnering_kandidaten", { _limit: 50 }),
  ]);
  if (e1 || e2) return json({ error: (e1 ?? e2)?.message }, 500);

  if (dryRun) {
    return json({
      dry_run: true, weekdag_nl: dag,
      verzoek: (nieuw ?? []).map((r: any) => ({ lead_id: r.lead_id, email: maskeer(r.email), geactiveerd_op: r.geactiveerd_op })),
      herinnering: (herinner ?? []).map((r: any) => ({ lead_id: r.lead_id, email: maskeer(r.email) })),
    });
  }

  const gate = createMailGate("review-verzoeken", req);

  async function afmeldToken(email: string): Promise<string> {
    const e = email.trim().toLowerCase();
    const { data: bestaand } = await admin.from("email_unsubscribe_tokens")
      .select("token").eq("email", e).is("used_at", null).limit(1).maybeSingle();
    if (bestaand?.token) return bestaand.token;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await admin.from("email_unsubscribe_tokens").insert({ email: e, token });
    return token;
  }

  async function verstuur(soort: ReviewSoort, leadId: string, email: string, voornaam: string | null, token: string) {
    const afmeld = await afmeldToken(email);
    const subject = reviewOnderwerp(soort);
    const html = reviewHtml({
      soort, voornaam,
      klikUrl: `${FN_BASE}/review-klik?t=${token}`,
      afmeldUrl: `https://zpzaken.nl/afmelden?token=${afmeld}`,
    });
    const plan = gate.plan({ to: email, subject, html });
    let status = "failed", messageId: string | null = null, err: string | null = null;
    if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
    else if (!RESEND_API_KEY) err = "RESEND_API_KEY ontbreekt";
    else {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: plan.from, to: plan.to, reply_to: "info@zpzaken.nl", subject: plan.subject, html: plan.html }),
      });
      const t = await r.text();
      if (r.ok) { status = "sent"; try { messageId = JSON.parse(t).id ?? null; } catch { /* */ } }
      else err = `Resend ${r.status}: ${t.slice(0, 300)}`;
    }
    await admin.from("email_send_log").insert({
      template_name: soort, recipient_email: email, status, message_id: messageId, error_message: err,
      metadata: { lead_id: leadId, redirected: plan.redirected, preview: !gate.isProduction },
    });
    return status === "sent";
  }

  const res = { verzoek: 0, herinnering: 0, mislukt: 0, preview: !gate.isProduction };

  for (const r of (nieuw ?? []) as any[]) {
    // Rij eerst aanmaken (unique lead_id) zodat een lead nooit twee keer een eerste verzoek krijgt.
    const { data: rij, error } = await admin.from("review_verzoeken")
      .insert({ lead_id: r.lead_id, email: r.email.trim(), status: "verstuurd" }).select("id, token").single();
    if (error || !rij) { res.mislukt++; continue; }
    const okSend = await verstuur("review_verzoek", r.lead_id, r.email.trim(), r.voornaam, rij.token);
    if (okSend) { await admin.from("review_verzoeken").update({ verstuurd_op: new Date().toISOString() }).eq("id", rij.id); res.verzoek++; }
    else { await admin.from("review_verzoeken").update({ status: "overgeslagen" }).eq("id", rij.id); res.mislukt++; }
  }

  for (const r of (herinner ?? []) as any[]) {
    const okSend = await verstuur("review_herinnering", r.lead_id, r.email, r.voornaam, r.token);
    // Herinnering is eenmalig: ook bij mislukken niet opnieuw proberen.
    await admin.from("review_verzoeken").update({
      herinnering_op: new Date().toISOString(), ...(okSend ? { status: "herinnerd" } : {}),
    }).eq("id", r.id);
    okSend ? res.herinnering++ : res.mislukt++;
  }

  return json({ ok: true, ...res });
});
