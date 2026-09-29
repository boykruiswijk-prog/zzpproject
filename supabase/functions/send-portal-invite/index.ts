// deno-lint-ignore-file no-explicit-any
// Uitnodiging voor Mijn ZP (K7). Alleen teamleden.
// Maakt zo nodig een bevestigde auth-gebruiker (zonder wachtwoord) voor het
// e-mailadres van de lead, koppelt alle polissen van de lead, en mailt één
// magic link (redirect via safeAppOrigin naar /portal).
// Ontvanger komt altijd uit leads.email; een e-mail in de body wordt genegeerd.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invitePortalLead } from "../_shared/portalAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: userData.user.id });
    if (!isTeam) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "");
    if (!UUID.test(leadId)) return json({ error: "lead_id vereist" }, 400);

    const out = await invitePortalLead(admin, req, leadId, userData.user.id);
    if (!out.ok) {
      const status = out.error === "lead_niet_gevonden" ? 404
        : ["geen_geldig_email", "geen_polis"].includes(out.error ?? "") ? 400 : 502;
      return json({ error: out.error ?? "uitnodigen mislukt", ...out }, status);
    }
    return json({ success: true, ...out });
  } catch (e: any) {
    console.error("send-portal-invite error", e?.message);
    return json({ error: e?.message ?? "onbekende fout" }, 500);
  }
});
