// Bescherming tegen wachtwoord-raden: houdt mislukte inlogpogingen per account
// en per IP bij en legt een afkoelperiode op na te veel mislukte pogingen.
//
// Acties:
//   { action: "check",  email }            → { locked, minutesLeft, attemptsLeft }
//   { action: "attempt", email, password } → server verifies and records the result
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
    const action = body?.action === "attempt" ? "attempt" : "check";
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "E-mailadres ontbreekt." }, 400);

    const ip = clientIp(req);

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { data, error } = await supabase
      .from("login_attempts")
      .select("created_at, succes")
      .eq("email", email)
      .eq("ip", ip)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[login-guard] kon pogingen niet lezen:", error.message);
      return json({ error: "guard_unavailable" }, 503);
    }

    const attempts = data ?? [];
    const latestSuccessIndex = attempts.findIndex((attempt) => attempt.succes === true);
    const failures = (latestSuccessIndex < 0 ? attempts : attempts.slice(0, latestSuccessIndex))
      .filter((attempt) => attempt.succes === false);
    if (failures.length < MAX_ATTEMPTS && action === "check") {
      return json({
        locked: false,
        minutesLeft: 0,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - failures.length),
      });
    }

    if (failures.length >= MAX_ATTEMPTS) {
      const last = new Date(failures[0].created_at as string).getTime();
      const msLeft = LOCKOUT_MINUTES * 60_000 - (Date.now() - last);
      if (msLeft > 0) {
        console.warn(`[login-guard] account tijdelijk geblokkeerd (${email}, ip ${ip})`);
        return json({ locked: true, minutesLeft: Math.ceil(msLeft / 60_000), attemptsLeft: 0 });
      }
    }
    if (action !== "attempt" || typeof body?.password !== "string" || !body.password) return json({ locked: false, minutesLeft: 0, attemptsLeft: MAX_ATTEMPTS });
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password: body.password });
    await supabase.from("login_attempts").insert({ email, ip, succes: !authError });
    if (authError || !authData.session) return json({ authenticated: false, locked: false, minutesLeft: 0, attemptsLeft: Math.max(0, MAX_ATTEMPTS - failures.length - 1) }, 401);
    return json({ authenticated: true, session: authData.session, locked: false, minutesLeft: 0, attemptsLeft: MAX_ATTEMPTS });
  } catch (err) {
    console.error("[login-guard] fout:", err);
    return json({ error: "guard_unavailable" }, 503);
  }
});
