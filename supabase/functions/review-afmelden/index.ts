// Afmelden voor reviewmails via email_unsubscribe_tokens -> suppressed_emails.
// GET ?token= controleert alleen; POST { token } meldt echt af (bescherming tegen linkscanners).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { clientIp } from "../_shared/antiSpam.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const ip = clientIp(req);
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
    .eq("ip", ip).eq("kind", "review-afmelden").gte("created_at", since);
  if ((count ?? 0) >= 20) return json({ error: "Te veel verzoeken, probeer het later opnieuw." }, 429);
  await admin.from("form_rate_limit").insert({ ip, kind: "review-afmelden" });

  let token = "";
  if (req.method === "GET") token = new URL(req.url).searchParams.get("token") ?? "";
  else if (req.method === "POST") token = String((await req.json().catch(() => ({})))?.token ?? "");
  else return json({ error: "method" }, 405);
  if (!/^[a-zA-Z0-9]{16,128}$/.test(token)) return json({ status: "ongeldig" });

  const { data: rij } = await admin.from("email_unsubscribe_tokens").select("id, email, used_at").eq("token", token).maybeSingle();
  if (!rij) return json({ status: "ongeldig" });
  if (rij.used_at) return json({ status: "al_afgemeld" });
  if (req.method === "GET") return json({ status: "geldig" });

  const email = rij.email.trim().toLowerCase();
  await admin.from("email_unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("id", rij.id);
  const { data: al } = await admin.from("suppressed_emails").select("id").ilike("email", email).limit(1).maybeSingle();
  if (!al) await admin.from("suppressed_emails").insert({ email, reason: "unsubscribe", metadata: { bron: "review-verzoeken" } });
  await admin.from("review_verzoeken").update({ status: "afgemeld" }).ilike("email", email);
  return json({ status: "afgemeld" });
});
