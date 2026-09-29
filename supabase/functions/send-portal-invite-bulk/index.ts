// deno-lint-ignore-file no-explicit-any
// Bulkuitnodigingen voor Mijn ZP. Alleen supervisor.
// Kandidaten: echte (is_test=false) leads met status actief/klant, met een polis,
// die nog nooit een portal_invitations-regel hebben gehad.
// Body: { limit?: number (standaard 50, max 200), dry_run?: boolean (standaard true) }
// Let op: dry_run staat standaard AAN; verzenden vereist expliciet dry_run=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invitePortalLead, type InviteOutcome } from "../_shared/portalAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function kandidaten(admin: any): Promise<string[]> {
  const { data: leads, error } = await admin
    .from("leads").select("id, created_at")
    .in("status", ["actief", "klant"]).eq("is_test", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (leads ?? []).map((l: any) => l.id);
  if (!ids.length) return [];
  const [{ data: pols }, { data: invs }] = await Promise.all([
    admin.from("policies").select("lead_id").in("lead_id", ids),
    admin.from("portal_invitations").select("lead_id").in("lead_id", ids),
  ]);
  const metPolis = new Set((pols ?? []).map((p: any) => p.lead_id));
  const uitgenodigd = new Set((invs ?? []).map((i: any) => i.lead_id));
  return ids.filter((id: string) => metPolis.has(id) && !uitgenodigd.has(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Unauthorized" }, 401);
    const { data: isSup } = await admin.rpc("is_supervisor_or_admin", { _user_id: u.user.id });
    if (!isSup) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const rawLimit = Number(body?.limit ?? 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50));
    const dryRun = body?.dry_run !== false;

    const alle = await kandidaten(admin);
    const batch = alle.slice(0, limit);
    if (dryRun) {
      return json({ dry_run: true, kandidaten_totaal: alle.length, deze_batch: batch.length });
    }

    const results: InviteOutcome[] = [];
    for (const id of batch) {
      try {
        results.push(await invitePortalLead(admin, req, id, u.user.id, "send-portal-invite-bulk"));
      } catch (e: any) {
        results.push({ lead_id: id, ok: false, error: e?.message ?? "fout" });
      }
      await new Promise((r) => setTimeout(r, 600)); // Resend: ruim onder 2 req/s
    }
    return json({
      dry_run: false,
      verstuurd: results.filter((r) => r.ok).length,
      mislukt: results.filter((r) => !r.ok).length,
      nog_open: alle.length - batch.length,
      mislukte_leads: results.filter((r) => !r.ok),
    });
  } catch (e: any) {
    console.error("send-portal-invite-bulk error", e?.message);
    return json({ error: e?.message ?? "onbekende fout" }, 500);
  }
});
