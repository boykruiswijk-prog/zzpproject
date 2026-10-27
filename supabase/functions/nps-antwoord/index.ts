// Publiek: slaat een NPS-score of toelichting op via het token uit de mail.
// Rate limit per IP (form_rate_limit), honeypot-veld "website". Lage score maakt in SQL een beltaak.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { clientIp } from "../_shared/antiSpam.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  token: z.string().regex(/^[a-f0-9]{32,128}$/i),
  score: z.number().int().min(0).max(10).optional(),
  toelichting: z.string().max(1000).optional(),
  website: z.string().optional(),
}).refine((b) => b.score !== undefined || b.toelichting !== undefined);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ status: "ongeldig" }, 400);
  const b = parsed.data;
  if (b.website) return json({ status: "opgeslagen" }); // honeypot: stil negeren

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const ip = clientIp(req);
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
    .eq("ip", ip).eq("kind", "nps-antwoord").gte("created_at", since);
  if ((count ?? 0) >= 20) return json({ error: "Te veel verzoeken, probeer het later opnieuw." }, 429);
  await admin.from("form_rate_limit").insert({ ip, kind: "nps-antwoord" });

  const { data, error } = await admin.rpc("nps_antwoord_opslaan", {
    _token: b.token, _score: b.score ?? null, _toelichting: b.score === undefined ? (b.toelichting ?? "").trim() : null,
  });
  if (error) return json({ status: "fout" }, 500);
  return json({ status: (data as { status?: string })?.status ?? "fout" });
});
