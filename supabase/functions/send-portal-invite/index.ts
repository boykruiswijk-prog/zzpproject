// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Verify caller is a team member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: userData.user.id });
    if (!isTeam) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, email } = body as { lead_id?: string; email?: string };
    if (!email) {
      return new Response(JSON.stringify({ error: "email vereist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Maak invitation aan
    const { data: invite, error: inviteErr } = await admin
      .from("portal_invitations")
      .insert({
        email: email.toLowerCase(),
        lead_id: lead_id || null,
        invited_by: userData.user.id,
        status: "pending",
      })
      .select()
      .single();

    if (inviteErr) throw inviteErr;

    const origin = req.headers.get("origin") || "https://zzpproject.lovable.app";
    const acceptUrl = `${origin}/portal/invite/${invite.token}`;

    // Verstuur via Resend (indien beschikbaar) — anders return alleen URL
    if (RESEND_API_KEY) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h2 style="color:#E53E2F;margin:0 0 16px">Welkom bij het ZP Zaken klantportaal</h2>
          <p>Hallo,</p>
          <p>Je bent uitgenodigd voor het klantportaal van ZP Zaken. Hier vind je je polis, certificaten, facturen en documenten op één centrale plek.</p>
          <p style="margin:24px 0">
            <a href="${acceptUrl}" style="background:#E53E2F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Account activeren
            </a>
          </p>
          <p style="font-size:13px;color:#666">Of kopieer deze link:<br/><span style="word-break:break-all">${acceptUrl}</span></p>
          <p style="font-size:13px;color:#666">Deze uitnodiging is 14 dagen geldig.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-size:12px;color:#888">ZP Zaken B.V. | Zorgeloos ZZP'en</p>
        </div>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ZP Zaken <info@zpzaken.nl>",
          to: [email],
          subject: "Uitnodiging voor het ZP Zaken klantportaal",
          html,
        }),
      });

      if (!emailRes.ok) {
        const t = await emailRes.text();
        console.error("Resend error", t);
      }
    }

    return new Response(
      JSON.stringify({ success: true, accept_url: acceptUrl, token: invite.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("send-portal-invite error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
