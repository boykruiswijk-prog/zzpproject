import { requireMfa } from "../_shared/teamAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const TOEGESTANE_ROLLEN = ["admin", "supervisor", "medewerker", "verzekering", "marketing"];
export const MIN_WACHTWOORD = 12;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify calling user is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Niet ingelogd");

    const mfa = await requireMfa(req);
    if (mfa instanceof Response) return mfa;
    const { data: roleRows } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin")) throw new Error("Geen admin-rechten");

    const { email, password, fullName, role } = await req.json();
    if (!email || !password || !fullName || !role) throw new Error("Alle velden zijn verplicht");
    // Beveiligingscheck 2-11: vaste lijst rollen, wachtwoord minimaal 12 tekens.
    if (!TOEGESTANE_ROLLEN.includes(role)) throw new Error("Ongeldige rol");
    if (typeof password !== "string" || password.length < MIN_WACHTWOORD) throw new Error(`Wachtwoord moet minimaal ${MIN_WACHTWOORD} tekens hebben`);
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) throw new Error("Ongeldig e-mailadres");
    if (typeof fullName !== "string" || fullName.trim().length > 200) throw new Error("Ongeldige naam");

    // Create user with admin API
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) throw createError;

    // Assign role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
    });

    if (roleError) throw roleError;

    // Logregel per aanmaak (geen wachtwoord).
    await adminClient.from("sensitive_audit_log").insert({
      target_table: "user_roles", target_id: newUser.user.id, actie: "teamlid_aangemaakt", veld: "role",
      nieuwe_waarde: role, uitgevoerd_door: user.id, uitgevoerd_door_email: user.email ?? null, uitgevoerd_door_rol: "admin",
      details: { email: String(email).trim().toLowerCase(), rol: role },
    });

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
