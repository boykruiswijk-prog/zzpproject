// Afmelden UITSLUITEND voor de herinneringsmail afgehaakte aanvragen: herinnering_afmeldingen.
// Raakt reviewverzoeken, suppressed_emails en transactionele mails niet.
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
    .eq("ip", ip).eq("kind", "herinnering-afmelden").gte("created_at", since);
  if ((count ?? 0) >= 20) return json({ error: "Te veel verzoeken, probeer het later opnieuw." }, 429);
  await admin.from("form_rate_limit").insert({ ip, kind: "herinnering-afmelden" });

  let token = "";
  if (req.method === "GET") token = new URL(req.url).searchParams.get("token") ?? "";
  else if (req.method === "POST") token = String((await req.json().catch(() => ({})))?.token ?? "");
  else return json({ error: "method" }, 405);
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ status: "ongeldig" });

  const { data: rij } = await admin.from("herinnering_afmeld_tokens").select("token, email, used_at").eq("token", token).maybeSingle();
  if (!rij) return json({ status: "ongeldig" });
  const email = String(rij.email).trim().toLowerCase();
  const { data: al } = await admin.from("herinnering_afmeldingen").select("email").eq("email", email).maybeSingle();
  if (rij.used_at || al) return json({ status: "al_afgemeld" });
  if (req.method === "GET") return json({ status: "geldig" });

  const { error } = await admin.from("herinnering_afmeldingen").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return json({ status: "fout" }, 500);
  await admin.from("herinnering_afmeld_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);
  return json({ status: "afgemeld" });
});
