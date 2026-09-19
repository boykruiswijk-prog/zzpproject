// Bescherming tegen wachtwoord-raden: houdt mislukte inlogpogingen per account
// en per IP bij en legt een afkoelperiode op na te veel mislukte pogingen.
//
// Acties:
//   { action: "check",  email }            → { locked, minutesLeft, attemptsLeft }
//   { action: "record", email, success }   → { locked, minutesLeft, attemptsLeft }
//
// Draait met de service-role key; de tabel login_attempts is voor anon dicht.
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { clientIp } from "../_shared/antiSpam.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "record" ? "record" : "check";
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "E-mailadres ontbreekt." }, 400);

    const ip = clientIp(req);

    if (action === "record") {
      const success = body?.success === true;
      await supabase.from("login_attempts").insert({ email, ip, succes: success });
      // Na een geslaagde login vervallen eerdere mislukte pogingen.
      if (success) {
        await supabase.from("login_attempts").delete().eq("email", email).eq("succes", false);
        return json({ locked: false, minutesLeft: 0, attemptsLeft: MAX_ATTEMPTS });
      }
    }

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { data, error } = await supabase
      .from("login_attempts")
      .select("created_at")
      .eq("email", email)
      .eq("succes", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Beschikbaarheid boven blokkade: laat door, maar log het.
      console.error("[login-guard] kon pogingen niet lezen:", error.message);
      return json({ locked: false, minutesLeft: 0, attemptsLeft: MAX_ATTEMPTS });
    }

    const failures = data ?? [];
    if (failures.length < MAX_ATTEMPTS) {
      return json({
        locked: false,
        minutesLeft: 0,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - failures.length),
      });
    }

    const last = new Date(failures[0].created_at as string).getTime();
    const msLeft = LOCKOUT_MINUTES * 60_000 - (Date.now() - last);
    if (msLeft <= 0) {
      return json({ locked: false, minutesLeft: 0, attemptsLeft: 1 });
    }

    console.warn(`[login-guard] account tijdelijk geblokkeerd (${email}, ip ${ip})`);
    return json({ locked: true, minutesLeft: Math.ceil(msLeft / 60_000), attemptsLeft: 0 });
  } catch (err) {
    console.error("[login-guard] fout:", err);
    return json({ locked: false, minutesLeft: 0, attemptsLeft: MAX_ATTEMPTS });
  }
});
