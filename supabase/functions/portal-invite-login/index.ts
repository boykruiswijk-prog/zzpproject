// deno-lint-ignore-file no-explicit-any
// Publiek: /portal/invite/:token zonder sessie. Bij een geldige, niet-verlopen
// uitnodiging mailt de server een magic link naar het adres van de uitnodiging
// (maakt zo nodig de gebruiker aan en koppelt de polissen van de lead).
// Antwoord is altijd neutraal ({ success: true }), behalve bij ongeldig/verlopen,
// zodat de pagina daar een passende melding kan tonen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { safeAppOrigin } from "../_shared/company.ts";
import { clientIp } from "../_shared/antiSpam.ts";
import {
  buildLoginHtml, ensurePortalUser, generateMagicLink, linkLeadPolicies, sendPortalMail,
} from "../_shared/portalAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function countSince(admin: any, key: string, kind: string, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
    .eq("ip", key).eq("kind", kind).gte("created_at", since);
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    if (!/^[0-9a-f]{16,128}$/i.test(token)) return json({ success: false, error: "invalid_token" });

    const { data: inv } = await admin.from("portal_invitations").select("*").eq("token", token).maybeSingle();
    if (!inv) return json({ success: false, error: "invalid_token" });
    if (inv.status === "expired" || new Date(inv.expires_at).getTime() < Date.now()) {
      return json({ success: false, error: "expired" });
    }

    // Limiet: 3 per uitnodiging per uur, 10 per IP per uur.
    const ip = clientIp(req);
    const tokKey = `invite:${inv.id}`;
    if ((await countSince(admin, tokKey, "portal_invite_login", 60)) >= 3 ||
        (await countSince(admin, ip, "portal_invite_login_ip", 60)) >= 10) {
      return json({ success: true });
    }
    await admin.from("form_rate_limit").insert([
      { ip: tokKey, kind: "portal_invite_login" },
      { ip, kind: "portal_invite_login_ip" },
    ]);

    const email = String(inv.email).toLowerCase();
    const { userId } = await ensurePortalUser(admin, email);
    if (inv.lead_id) await linkLeadPolicies(admin, inv.lead_id, userId);

    const origin = safeAppOrigin(req.headers.get("origin"));
    const link = await generateMagicLink(admin, email, `${origin}/portal/invite/${token}`);
    await sendPortalMail(admin, req, "portal-invite-login", {
      to: email, subject: "Je inloglink voor Mijn ZP", html: buildLoginHtml(link),
      leadType: "portal_login", leadId: inv.lead_id, metadata: { via: "invite_token" },
    });
    return json({ success: true });
  } catch (e: any) {
    console.error("portal-invite-login error", e?.message);
    return json({ success: true });
  }
});
