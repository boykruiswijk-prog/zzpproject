// A20-aanvulling 1: elke 15 minuten (cron, x-cron-secret uit Vault). Eenmalige herinnering aan
// afgehaakte aanvragen (2 tot 24 uur stil, vanaf het aanzetmoment, minstens stap 2). Selectie en claim in SQL
// (afhaak_herinnering_kandidaten/_claim, met misbruikrem per IP-hash en afmeldlijst).
// Body { dry_run: true } mailt en schrijft niets.
// Body { eenmalig: "2610-3110" } (besluit Boy 2-11): eenmalige groep 26-10 t/m 31-10 via afhaak_eenmalig_*;
// SQL laat elk adres maximaal één keer toe, dus herhalen verstuurt niets dubbel.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createMailGate } from "../_shared/mail.ts";
import { geldigEmail } from "../_shared/geldigEmail.ts";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { bouwHerinneringMelding, type NabelConcept } from "../_shared/nabellen.ts";
import { isTestInvoer } from "../_shared/testInvoer.ts";
import { AFHAAK_LEAD_TYPE, AFHAAK_ONDERWERP, afhaakHtml, afhaakResendBody, afhaakAfmeldUrl } from "../_shared/afhaakHerinnering.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function nieuwToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

type Kandidaat = { id: string; email: string; voornaam: string | null; stap?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const eenmalig = body?.eenmalig === "2610-3110";

  let lijst: Kandidaat[];
  if (eenmalig) {
    const { data, error } = await admin.rpc("afhaak_eenmalig_kandidaten");
    if (error) return json({ error: error.message }, 500);
    lijst = ((data ?? []) as Kandidaat[]).filter((k) => !!geldigEmail(k.email));
  }
  // Bekende placeholderinvoer krijgt nooit een herinnering (vangnet naast is_test).
  lijst = lijst.filter((k) => !isTestInvoer({ email: k.email })); else {
    const { data: cfg } = await admin.from("facturatie_config").select("herinnering_afhaak_vanaf").eq("id", 1).maybeSingle();
    if (!cfg?.herinnering_afhaak_vanaf) return json({ skipped: "uitgeschakeld" });
    const { data, error } = await admin.rpc("afhaak_herinnering_kandidaten", { _limit: 25 });
    if (error) return json({ error: error.message }, 500);
    lijst = ((data ?? []) as Kandidaat[]).filter((k) => !!geldigEmail(k.email));
  }
  // Bekende placeholderinvoer krijgt nooit een herinnering (vangnet naast is_test).
  lijst = lijst.filter((k) => !isTestInvoer({ email: k.email }));
  // Droge run: alleen id en stap, geen persoonsgegevens.
  if (dryRun) return json({ dry_run: true, eenmalig, aantal: lijst.length, kandidaten: lijst.map((k) => ({ id: k.id, stap: k.stap ?? null })) });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const gate = createMailGate("afhaak-herinnering", req);
  const res = { verstuurd: 0, mislukt: 0, overgeslagen: 0, preview: !gate.isProduction };
  for (const k of lijst) {
    const to = geldigEmail(k.email)!;
    const { data: claim } = eenmalig
      ? await admin.rpc("afhaak_eenmalig_claim", { _id: k.id })
      : await admin.rpc("afhaak_herinnering_claim", { _id: k.id });
    if (claim !== true) { res.overgeslagen++; continue; }
    const token = nieuwToken();
    const { error: tokErr } = await admin.from("herinnering_afmeld_tokens").insert({ token, email: to.toLowerCase() });
    const afmeldUrl = tokErr ? undefined : afhaakAfmeldUrl(token);
    const plan = gate.plan({ to, subject: AFHAAK_ONDERWERP, html: afhaakHtml(k.voornaam, afmeldUrl) });
    let status = "failed", messageId: string | null = null, err: string | null = null;
    if (!afmeldUrl) err = "afmeldtoken niet opgeslagen, niet verstuurd";
    else if (!plan.send) { status = "skipped"; err = plan.reason ?? null; }
    else if (!RESEND_API_KEY) err = "RESEND_API_KEY ontbreekt";
    else {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify(afhaakResendBody({ from: plan.from, to: plan.to, subject: plan.subject, html: plan.html, voornaam: k.voornaam, afmeldUrl })),
        });
        const t = await resp.text();
        if (resp.ok) { status = "sent"; try { messageId = JSON.parse(t).id ?? null; } catch { /* */ } }
        else err = `Resend ${resp.status}: ${t.slice(0, 300)}`;
      } catch (e) { err = `verzendfout: ${String(e).slice(0, 200)}`; }
    }
    // Geen nieuwe poging; herinnering_verstuurd_op blijft staan, dus ook nooit een tweede mail later.
    await admin.from("lead_notification_log").insert({
      lead_type: AFHAAK_LEAD_TYPE, lead_id: null, recipient: to, subject: AFHAAK_ONDERWERP, status,
      error_message: err, resend_message_id: messageId,
      metadata: { concept_id: k.id, redirected: plan.redirected, preview: !gate.isProduction, ...(eenmalig ? { eenmalig: "2610-3110", stap: k.stap ?? null } : {}) },
    });
    if (status === "sent") {
      res.verstuurd++;
      // Besluit Boy 3-11: pas na een verstuurde herinnering één interne melding (geen belverzoek).
      const { data: c } = await admin.from("aanvraag_concepten")
        .select("id,status,is_test,lead_id,dubbel_lead_id,telefoon,email,laatst_actief_op,team_gemeld_op,voornaam,achternaam,bedrijfsnaam,pakket,stap,max_stap,attributie,herinnering_verstuurd_op")
        .eq("id", k.id).maybeSingle();
      if (c && !isTestInvoer({ email: c.email, telefoon: c.telefoon })) {
        const m = bouwHerinneringMelding(c as NabelConcept, (c as { herinnering_verstuurd_op?: string }).herinnering_verstuurd_op ?? new Date().toISOString());
        try {
          await verstuurInterneMelding(admin, req, "afhaak-herinnering-melding", {
            leadType: "afhaak_herinnering_melding", subject: m.subject, html: m.html, text: m.text, metadata: { concept_id: k.id },
          });
        } catch (e) { console.error("afhaak-herinnering: interne melding mislukt", String(e).slice(0, 200)); }
      }
    } else res.mislukt++;
  }
  return json({ ok: true, eenmalig, ...res });
});
