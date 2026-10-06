// Publieke kliklink uit het reviewverzoek: legt de eerste klik vast en stuurt door naar Google.
// Onbekend token of limiet bereikt: altijd gewoon doorsturen naar Google.
import { createClient } from "npm:@supabase/supabase-js@2";
import { clientIp } from "../_shared/antiSpam.ts";
import { GOOGLE_REVIEW_URL } from "../_shared/reviewMail.ts";

const redirect = () => new Response(null, { status: 302, headers: { Location: GOOGLE_REVIEW_URL, "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  try {
    const t = new URL(req.url).searchParams.get("t") ?? "";
    if (!/^[a-f0-9]{32,128}$/i.test(t)) return redirect();
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const ip = clientIp(req);
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
      .eq("ip", ip).eq("kind", "review-klik").gte("created_at", since);
    if ((count ?? 0) >= 20) return redirect();
    await admin.from("form_rate_limit").insert({ ip, kind: "review-klik" });
    await admin.from("review_verzoeken").update({ geklikt_op: new Date().toISOString() })
      .eq("token", t).is("geklikt_op", null);
  } catch (e) {
    console.error("review-klik:", e instanceof Error ? e.message : e);
  }
  return redirect();
});
