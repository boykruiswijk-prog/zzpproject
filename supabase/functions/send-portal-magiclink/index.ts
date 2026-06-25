// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEUTRAL_OK = { success: true } as const;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(actionUrl: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#ffffff">
    <h2 style="color:#E53E2F;margin:0 0 16px;font-size:20px">Inloggen op het ZP Zaken klantportaal</h2>
    <p style="margin:0 0 16px;line-height:1.5">Beste klant,</p>
    <p style="margin:0 0 16px;line-height:1.5">
      Je hebt een inloglink aangevraagd voor het ZP Zaken klantportaal.
      Klik op onderstaande knop om direct ingelogd te worden. De link is eenmalig te gebruiken en blijft 1 uur geldig.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(actionUrl)}"
         style="background:#E53E2F;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">
        Inloggen op het klantportaal
      </a>
    </p>
    <p style="font-size:13px;color:#555;margin:0 0 8px">Werkt de knop niet? Kopieer dan deze link in je browser:</p>
    <p style="font-size:12px;color:#666;word-break:break-all;margin:0 0 24px">${escapeHtml(actionUrl)}</p>
    <p style="font-size:13px;color:#555;line-height:1.5;margin:0 0 16px">
      Heb je geen inloglink aangevraagd? Dan kun je deze e-mail negeren. Er wordt geen toegang verleend zonder dat de link wordt geopend.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888;margin:0">ZP Zaken B.V. | info@zpzaken.nl | 020 - 457 3077</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <info@zpzaken.nl>";

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const redirect = typeof body?.redirect === "string" && body.redirect.startsWith("/")
      ? body.redirect
      : "/portal";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      // Neutraal antwoord om enumeratie te voorkomen.
      return new Response(JSON.stringify(NEUTRAL_OK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://zpzaken.nl";
    const redirectTo = `${origin}${redirect}`;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Bestaand account vereist — geen account = geen mail, geen aanmaak.
    let accountExists = false;
    try {
      // Probeer eerst paginated lookup. Bij grote user-tabellen is dit suboptimaal,
      // maar afdoende voor huidige schaal en geen extra schema-aanname nodig.
      // Gebruik filter via email — admin.listUsers ondersteunt geen direct email-filter,
      // dus we proberen een gerichte query via auth schema.
      const { data: userByEmail, error: lookupErr } = await admin
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle()
        .then(async () => {
          // Fallback altijd via auth admin API — profiles bevat geen email betrouwbaar.
          return { data: null, error: null } as any;
        });
      void userByEmail; void lookupErr;

      // Definitieve check: auth.users via service role.
      // Supabase JS exposeert geen direct getUserByEmail; gebruik listUsers met filter.
      // Voor performance: paginate kort en stop bij match.
      let page = 1;
      const perPage = 200;
      while (page <= 10 && !accountExists) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) break;
        if (!data?.users?.length) break;
        if (data.users.some((u) => (u.email ?? "").toLowerCase() === email)) {
          accountExists = true;
          break;
        }
        if (data.users.length < perPage) break;
        page++;
      }
    } catch (e) {
      console.error("[send-portal-magiclink] lookup failed", e);
    }

    if (!accountExists) {
      console.log(`[send-portal-magiclink] no account for ${email} — silently ignored`);
      return new Response(JSON.stringify(NEUTRAL_OK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Genereer magic link server-side.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[send-portal-magiclink] generateLink failed", linkErr);
      return new Response(JSON.stringify(NEUTRAL_OK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionUrl = linkData.properties.action_link;

    // 3. Verstuur via Resend.
    if (!RESEND_API_KEY) {
      console.error("[send-portal-magiclink] RESEND_API_KEY niet geconfigureerd");
      return new Response(JSON.stringify(NEUTRAL_OK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Je inloglink voor het ZP Zaken klantportaal",
        html: buildHtml(actionUrl),
      }),
    });

    if (!resendRes.ok) {
      const t = await resendRes.text();
      console.error("[send-portal-magiclink] Resend error", resendRes.status, t);
    } else {
      const j = await resendRes.json().catch(() => ({}));
      console.log(`[send-portal-magiclink] sent to ${email}`, j?.id);
    }

    return new Response(JSON.stringify(NEUTRAL_OK), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-portal-magiclink] unexpected", e);
    // Altijd neutraal naar buiten.
    return new Response(JSON.stringify(NEUTRAL_OK), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
