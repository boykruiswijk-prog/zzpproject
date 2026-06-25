// Dagelijkse cron: stuurt reminder mail naar klanten die >90 dagen gepauzeerd zijn
// en nog geen reminder ontvingen. Markeert hen daarna in DB.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

async function sendMail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_ADDRESS") || "ZP Zaken <info@zpzaken.nl>", to: [to], subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: leads, error } = await supabase
    .from("leads").select("id, voornaam, email, pauze_start_datum")
    .eq("status", "gepauzeerd")
    .lte("pauze_start_datum", cutoff)
    .is("pauze_reminder_verzonden_op", null)
    .limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  let count = 0;
  for (const l of leads ?? []) {
    await sendMail(l.email, "Je polis is al ruim 3 maanden gepauzeerd",
      `<p>Hoi ${l.voornaam},</p><p>Je polis staat sinds ${l.pauze_start_datum} op pauze. Klaar om weer te starten? Log in op je portaal en klik op 'Hervatten'.</p>
       <p><a href="https://zzpproject.lovable.app/portal/polis">Naar mijn polis</a></p>`);
    await supabase.from("leads").update({ pauze_reminder_verzonden_op: new Date().toISOString() }).eq("id", l.id);
    await supabase.from("polis_audit_log").insert({
      lead_id: l.id, actie: "reminder_verzonden", rol: "system",
      details: { dagen_pauze: Math.round((Date.now() - new Date(l.pauze_start_datum).getTime()) / (1000 * 60 * 60 * 24)) },
    });
    count++;
  }
  return new Response(JSON.stringify({ ok: true, count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
