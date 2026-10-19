import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** Validate the session and MFA; callers retain their existing role checks. */
export async function requireMfa(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const failure = (error: string, status: number) => new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (!/^Bearer\s+/i.test(authHeader)) return failure("unauthorized", 401);
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return failure("unauthorized", 401);
  if (jwtAal(token) !== "aal2") return failure("mfa_required", 403);
  return { userId: user.id };
}

function jwtAal(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const claims = JSON.parse(atob(payload)) as Record<string, unknown>;
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
export async function requireSupervisor(req: Request, admin: any): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const token = authHeader.slice("Bearer ".length).trim();
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (jwtAal(token) !== "aal2") return new Response(JSON.stringify({ error: "mfa_required" }), { status: 403, headers: { "Content-Type": "application/json" } });
  const { data: allowed } = await admin.rpc("is_supervisor_or_admin", { _user_id: user.id });
  if (allowed !== true) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  return { userId: user.id };
}

/** Supervisor, admin of verzekering, met 2FA. */
// deno-lint-ignore no-explicit-any
export async function requireVerzekeringOfSupervisor(req: Request, admin: any): Promise<{ userId: string } | Response> {
  const r = await requireSupervisor(req, admin);
  if (!(r instanceof Response) || r.status !== 403) return r;
  const body = await r.clone().json().catch(() => ({}));
  if (body?.error !== "forbidden") return r;
  const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return r;
  const { data: ok } = await admin.rpc("has_role", { _user_id: user.id, _role: "verzekering" });
  return ok === true ? { userId: user.id } : r;
}
