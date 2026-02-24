import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: roleData } = await userClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "admin") throw new Error("Geen admin rechten");

    const { email, password, fullName, role } = await req.json();
    if (!email || !password || !fullName || !role) throw new Error("Alle velden zijn verplicht");

    // Create user with admin API
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
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
