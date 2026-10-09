// Mailt nieuwe wijzigingsmeldingen (gemaild_op IS NULL) naar de ontvangers van
// meldingssoort 'wijziging_site_admin'. Alleen aan te roepen met x-cron-secret
// (trigger na insert en vangnet-cron, beide met het geheim uit Vault).
import { createClient } from "npm:@supabase/supabase-js@2";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";
import { COMPANY } from "../_shared/company.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function markdownLight(text: string): string {
  const out: string[] = [];
  let lijst: string[] = [];
  const flush = () => {
    if (lijst.length) out.push(`<ul style="margin:0 0 12px 18px;padding:0">${lijst.map((l) => `<li style="margin:0 0 4px">${l}</li>`).join("")}</ul>`);
    lijst = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("- ")) { lijst.push(esc(line.slice(2))); continue; }
    flush();
    if (line) out.push(`<p style="margin:0 0 10px">${esc(line)}</p>`);
  }
  flush();
  return out.join("");
}

const ONDERDEEL: Record<string, { tekst: string; links: { label: string; url: string }[] }> = {
  website: { tekst: "Op de website", links: [{ label: "Website openen", url: COMPANY.url }] },
  admin: { tekst: "In de admin", links: [{ label: "Admin openen", url: `${COMPANY.url}/admin` }] },
  beide: { tekst: "Op de website en in de admin", links: [{ label: "Website openen", url: COMPANY.url }, { label: "Admin openen", url: `${COMPANY.url}/admin` }] },
};

const blok = (kop: string, inhoud: string) =>
  `<h3 style="margin:20px 0 8px;font-size:15px;color:#E53E2F">${kop}</h3>${inhoud}`;

type Rij = { id: string; titel: string; omschrijving: string; onderdeel: string; wat_moet_ellen_doen: string | null; created_at: string };

function bouwMail(r: Rij) {
  const o = ONDERDEEL[r.onderdeel] ?? ONDERDEEL.beide;
  const links = o.links.map((l) => `<a href="${l.url}" style="color:#E53E2F">${esc(l.label)}</a>`).join(" &nbsp;|&nbsp; ");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;max-width:600px">
<h2 style="margin:0 0 12px;font-size:18px">${esc(r.titel)}</h2>
${blok("Wat is er veranderd", markdownLight(r.omschrijving))}
${blok("Waar zie je het", `<p style="margin:0 0 6px">${o.tekst}</p><p style="margin:0 0 10px">${links}</p>`)}
${r.wat_moet_ellen_doen?.trim() ? blok("Wat moet je doen", markdownLight(r.wat_moet_ellen_doen)) : ""}
<p style="margin:24px 0 0;font-size:12px;color:#666">Interne melding van ZP Zaken. Je ontvangt deze mail bij elke wijziging aan de website of de admin.</p>
</div>`;
  const text = [r.titel, "", "Wat is er veranderd", r.omschrijving, "", "Waar zie je het", o.tekst, ...o.links.map((l) => `${l.label}: ${l.url}`),
    ...(r.wat_moet_ellen_doen?.trim() ? ["", "Wat moet je doen", r.wat_moet_ellen_doen] : [])].join("\n");
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const { data: rijen, error } = await admin.from("wijzigingsmeldingen")
    .select("id,titel,omschrijving,onderdeel,wat_moet_ellen_doen,created_at")
    .is("gemaild_op", null).order("created_at").limit(25);
  if (error) return json({ error: error.message }, 500);

  const resultaten = [];
  for (const r of (rijen ?? []) as Rij[]) {
    // Claim de rij eerst, zodat trigger en vangnet niet dubbel mailen.
    const { data: claim } = await admin.from("wijzigingsmeldingen")
      .update({ gemaild_op: new Date().toISOString() }).eq("id", r.id).is("gemaild_op", null).select("id");
    if (!claim?.length) continue;
    const { html, text } = bouwMail(r);
    const res = await verstuurInterneMelding(admin, req, "wijziging-mailen", {
      leadType: "wijziging-site-admin",
      subject: `Wijziging ZP Zaken: ${r.titel}`,
      html, text,
      soort: "wijziging_site_admin",
      metadata: { wijzigingsmelding_id: r.id },
    });
    const geslaagd = res.length > 0 && res.every((x) => x.ok);
    if (!geslaagd) {
      // Terugzetten zodat het vangnet het opnieuw probeert.
      await admin.from("wijzigingsmeldingen").update({ gemaild_op: null }).eq("id", r.id);
    } else {
      const { data: logRij } = await admin.from("lead_notification_log").select("id")
        .eq("lead_type", "wijziging-site-admin").eq("status", "sent")
        .contains("metadata", { wijzigingsmelding_id: r.id })
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (logRij?.id) await admin.from("wijzigingsmeldingen").update({ mail_log_id: logRij.id }).eq("id", r.id);
    }
    resultaten.push({ id: r.id, geslaagd });
  }
  return json({ ok: true, verwerkt: resultaten.length, resultaten });
});
