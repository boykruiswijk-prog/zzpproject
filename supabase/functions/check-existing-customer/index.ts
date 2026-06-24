import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  email?: string;
  kvk?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, kvk } = (await req.json()) as Body;
    const cleanEmail = (email ?? "").trim().toLowerCase();
    const cleanKvk = (kvk ?? "").trim();

    if (!cleanEmail && !cleanKvk) {
      return new Response(
        JSON.stringify({ exists: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Bouw OR filter — alleen geactiveerde, productie-klanten tellen mee.
    const orParts: string[] = [];
    if (cleanEmail) orParts.push(`email.ilike.${cleanEmail}`);
    if (cleanKvk) orParts.push(`kvk_nummer.eq.${cleanKvk}`);

    const { data, error } = await supabase
      .from("leads")
      .select("email, kvk_nummer, status, exact_account_id")
      .or(orParts.join(","))
      .not("exact_account_id", "is", null)
      .in("status", ["actief", "klant"]);

    if (error) throw error;

    const rows = data ?? [];
    const emailHit = cleanEmail && rows.some((r) => (r.email ?? "").toLowerCase() === cleanEmail);
    const kvkHit = cleanKvk && rows.some((r) => (r.kvk_nummer ?? "").trim() === cleanKvk);

    let match_type: "email" | "kvk" | "both" | null = null;
    if (emailHit && kvkHit) match_type = "both";
    else if (emailHit) match_type = "email";
    else if (kvkHit) match_type = "kvk";

    return new Response(
      JSON.stringify({ exists: match_type !== null, match_type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("check-existing-customer error:", message);
    // Fail-open: bij fout in lookup blokkeren we de aanvraag niet.
    return new Response(
      JSON.stringify({ exists: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
