// Meldt gewijzigde URL's bij IndexNow (Bing, Yandex e.a.). Alleen admin/
// supervisor (met MFA) of de service-role (cron) mag dit aanroepen.
// Body: { paths?: string[] } of { alles: true } (alle URL's uit de sitemap).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const HOST = "zpzaken.nl";
const KEY = "4c39ea93eb96280b58fe48cc47b4a5c4"; // publiek sleutelbestand: /<KEY>.txt
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  paths: z.array(z.string().regex(/^\/[a-z0-9\-/]*$/i).max(300)).max(1000).optional(),
  alles: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
  const isCron = serviceKey !== "" && req.headers.get("Authorization") === `Bearer ${serviceKey}`;
  if (!isCron) {
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  let urls = (parsed.data.paths ?? []).map((p) => `https://${HOST}${p}`);
  if (parsed.data.alles) {
    const res = await fetch(`https://${HOST}/sitemap.xml`);
    if (!res.ok) return json({ error: "sitemap_unavailable", status: res.status }, 502);
    urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  urls = [...new Set(urls)].filter((u) => new URL(u).host === HOST).slice(0, 10000);
  if (!urls.length) return json({ error: "geen_urls" }, 400);

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  });
  return json({ ok: res.ok, status: res.status, aantal: urls.length });
});
