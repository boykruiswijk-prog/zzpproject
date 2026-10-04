import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

const schema = z.object({ route: z.enum(["nieuwe-aanvraag", "opzegging", "contactverzoek", "terugbelverzoek", "certificaat-opgevraagd", "pauze", "heractivering"]) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const auth = req.headers.get("Authorization") ?? "";
  const { data: { user } } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data: allowed } = await admin.rpc("is_admin", { _user_id: user.id });
  if (!allowed) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const subject = `[TEST] Interne melding – ${parsed.data.route}`;
  const results = await verstuurInterneMelding(admin, req, "test-interne-meldingen", {
    leadType: `test-${parsed.data.route}`,
    subject,
    html: `<p>Dit is een interne testmelding voor de route <strong>${parsed.data.route}</strong>. Er is geen klantmail verstuurd.</p>`,
    metadata: { is_test: true, route: parsed.data.route, no_customer_mail: true },
  });
  return new Response(JSON.stringify({ success: results.every((r) => r.ok), results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});