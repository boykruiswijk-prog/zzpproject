// deno-lint-ignore-file no-explicit-any
// Inloglink opvragen op /portal/login. Alleen bestaande gebruikers met een
// gekoppelde polis krijgen een mail. Antwoord is altijd neutraal.
// M5: max 3 aanvragen per e-mailadres per uur en 10 per IP per uur
// (form_rate_limit; e-mailadres alleen als SHA-256-hash opgeslagen).
// Redirect alleen via safeAppOrigin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { safeAppOrigin } from "../_shared/company.ts";
import { clientIp } from "../_shared/antiSpam.ts";
import { buildLoginHtml, findUserIdByEmail, generateMagicLink, sendPortalMail } from "../_shared/portalAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NEUTRAL = () => new Response(JSON.stringify({ success: true }), {
  status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const EMAIL_MAX = 3;
const IP_MAX = 10;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    // Alleen paden binnen het portaal; geen //host of andere schema's.
    const redirect = typeof body?.redirect === "string" && /^\/portal(\/[A-Za-z0-9/_-]*)?$/.test(body.redirect)
      ? body.redirect : "/portal";
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NEUTRAL();

    // Rate limit (telt elke aanvraag, ook voor onbekende adressen).
    const ip = clientIp(req);
    const emailKey = `email:${await sha256(email)}`;
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: eCount }, { count: iCount }] = await Promise.all([
      admin.from("form_rate_limit").select("id", { count: "exact", head: true })
        .eq("ip", emailKey).eq("kind", "portal_magiclink_email").gte("created_at", since),
      admin.from("form_rate_limit").select("id", { count: "exact", head: true })
        .eq("ip", ip).eq("kind", "portal_magiclink_ip").gte("created_at", since),
    ]);
    if ((eCount ?? 0) >= EMAIL_MAX || (iCount ?? 0) >= IP_MAX) {
      console.warn("[send-portal-magiclink] rate limit bereikt", { email_limit: (eCount ?? 0) >= EMAIL_MAX, ip_limit: (iCount ?? 0) >= IP_MAX });
      return NEUTRAL();
    }
    await admin.from("form_rate_limit").insert([
      { ip: emailKey, kind: "portal_magiclink_email" },
      { ip, kind: "portal_magiclink_ip" },
    ]);

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) return NEUTRAL();
    const { count: polCount } = await admin.from("policies").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (!polCount) return NEUTRAL();

    const origin = safeAppOrigin(req.headers.get("origin"));
    const link = await generateMagicLink(admin, email, `${origin}${redirect}`);
    const { data: pol } = await admin.from("policies").select("lead_id").eq("user_id", userId).limit(1).maybeSingle();
    await sendPortalMail(admin, req, "send-portal-magiclink", {
      to: email, subject: "Je inloglink voor Mijn ZP", html: buildLoginHtml(link),
      leadType: "portal_login", leadId: pol?.lead_id ?? null, metadata: { via: "login_page" },
    });
    return NEUTRAL();
  } catch (e: any) {
    console.error("[send-portal-magiclink] unexpected", e?.message);
    return NEUTRAL();
  }
});
