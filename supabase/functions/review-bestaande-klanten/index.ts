// Eenmalig reviewverzoek aan 100 bestaande klanten (Reviews 3, akkoord Boy 2-11-2026), in twee rondes van 50.
// Doelgroep is bevroren in review_bestaand_doelgroep. Alleen x-cron-secret (Vault) of service role.
// Body { dry_run: true|false, ronde: 1|2, test_naar?: "...@zpzaken.nl" }.
// dry_run: telt en controleert, mailt en schrijft niets. test_naar: één voorbeeldmail, schrijft niets in review_verzoeken.
// Herinnering na 7 dagen loopt via de bestaande dagelijkse review-verzoeken (review_herinnering_kandidaten).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createMailGate } from "../_shared/mail.ts";
import { isIntegratieEnabled } from "../_shared/integraties.ts";
import { reviewHtml, reviewOnderwerp } from "../_shared/reviewMail.ts";
import { maskeer, testNaarToegestaan, valideerBody } from "./regels.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FN_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SOORT = "review_verzoek_bestaand" as const;

const nlWeekdag = (d = new Date()) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(d);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", SRK);
  const secret = req.headers.get("x-cron-secret") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let ok = !!SRK && bearer === SRK;
  if (!ok && secret) ok = (await admin.rpc("verify_cron_secret", { p_secret: secret })).data === true;
  if (!ok) return json({ error: "unauthorized" }, 401);

  const parsed = valideerBody(await req.json().catch(() => null));
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { dryRun, ronde, testNaar } = parsed;

  if (!(await isIntegratieEnabled(admin, "reviewverzoeken_actief"))) return json({ skipped: "uitgeschakeld" });
  const dag = nlWeekdag();
  if (!dryRun && (dag === "Sat" || dag === "Sun")) return json({ skipped: "weekend" });

  const gate = createMailGate("review-bestaande-klanten", req);

  async function verstuur(to: string, voornaam: string | null, token: string, afmeldUrl: string, meta: Record<string, unknown>) {
    const html = reviewHtml({ soort: SOORT, voornaam, klikUrl: `${FN_BASE}/review-klik?t=${token}`, afmeldUrl });
    const plan = gate.plan({ to, subject: reviewOnderwerp(SOORT, voornaam), html });
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
      template_name: SOORT, recipient_email: to, status, message_id: messageId, error_message: err,
      metadata: { ...meta, redirected: plan.redirected, preview: !gate.isProduction },
    });
    return status === "sent";
  }

  if (testNaar) {
    if (!testNaarToegestaan(testNaar)) return json({ error: "test_naar alleen voor @zpzaken.nl" }, 400);
    // Niet-werkend testtoken (bestaat niet in review_verzoeken): klik stuurt alleen door naar Google.
    const sent = await verstuur(testNaar, "Boy", "0".repeat(48), "https://zpzaken.nl/afmelden?token=voorbeeld", { test: true, ronde });
    return json({ ok: sent, test_naar: testNaar });
  }

  const [{ data: rijen, error: e1 }, { data: bestaand, error: e2 }, { data: afgemeld }, { data: tokens }] = await Promise.all([
    admin.from("review_bestaand_doelgroep").select("id, email, voornaam, onderneming_id, begin_datum").eq("ronde", ronde).order("begin_datum", { ascending: false }),
    admin.from("review_verzoeken").select("email, doelgroep_id"),
    admin.from("review_afmeldingen").select("email"),
    admin.from("email_unsubscribe_tokens").select("email").not("used_at", "is", null),
  ]);
  if (e1 || e2) return json({ error: (e1 ?? e2)?.message }, 500);
  const al = new Set((bestaand ?? []).map((r: any) => String(r.email).trim().toLowerCase()));
  const uit = new Set([...(afgemeld ?? []), ...(tokens ?? [])].map((r: any) => String(r.email).trim().toLowerCase()));
  const lijst = (rijen ?? []) as any[];
  const emails = lijst.map((r) => r.email);
  const dubbel = emails.filter((e, i) => emails.indexOf(e) !== i);
  const teSturen = lijst.filter((r) => !al.has(r.email) && !uit.has(r.email));

  if (dryRun) {
    return json({
      dry_run: true, ronde, weekdag_nl: dag, aantal: lijst.length, te_versturen: teSturen.length,
      dubbel_in_ronde: dubbel.length, al_verstuurd: lijst.filter((r) => al.has(r.email)).length,
      afgemeld: lijst.filter((r) => uit.has(r.email)).length,
      begin_datum_van: lijst.at(-1)?.begin_datum ?? null, begin_datum_tot: lijst[0]?.begin_datum ?? null,
      adressen: teSturen.map((r) => maskeer(r.email)),
    });
  }

  async function afmeldToken(email: string): Promise<string> {
    const { data: b } = await admin.from("email_unsubscribe_tokens").select("token").eq("email", email).is("used_at", null).limit(1).maybeSingle();
    if (b?.token) return b.token;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await admin.from("email_unsubscribe_tokens").insert({ email, token });
    return token;
  }

  const res = { verstuurd: 0, mislukt: 0, overgeslagen: lijst.length - teSturen.length, preview: !gate.isProduction };
  for (const r of teSturen) {
    // Eerst de rij (uniek op doelgroep_id en e-mail), zodat niemand dubbel een verzoek krijgt.
    const { data: rij, error } = await admin.from("review_verzoeken")
      .insert({ doelgroep_id: r.id, email: r.email, status: "verstuurd" }).select("id, token").single();
    if (error || !rij) { res.overgeslagen++; continue; }
    const afmeldUrl = `https://zpzaken.nl/afmelden?token=${await afmeldToken(r.email)}`;
    const okSend = await verstuur(r.email, r.voornaam, rij.token, afmeldUrl, { doelgroep_id: r.id, ronde, onderneming_id: r.onderneming_id });
    if (okSend) { await admin.from("review_verzoeken").update({ verstuurd_op: new Date().toISOString() }).eq("id", rij.id); res.verstuurd++; }
    else { await admin.from("review_verzoeken").update({ status: "overgeslagen" }).eq("id", rij.id); res.mislukt++; }
  }
  return json({ ok: true, ronde, ...res });
});
