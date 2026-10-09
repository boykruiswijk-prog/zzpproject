// Interne melding na RPC bav_nummer_override_bevestigen. Alleen teamrollen, alleen interne ontvangers (soort bav_override), nooit naar klanten.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verstuurInterneMelding } from "../_shared/interneMelding.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);
  const [{ data: sup }, { data: verz }] = await Promise.all([
    admin.rpc("is_supervisor_or_admin", { _user_id: user.id }),
    admin.rpc("has_role", { _user_id: user.id, _role: "verzekering" }),
  ]);
  if (sup !== true && verz !== true) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => null);
  const auditId = typeof body?.audit_id === "string" ? body.audit_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(auditId)) return json({ error: "audit_id ontbreekt" }, 400);
  const { data: log } = await admin.from("sensitive_audit_log").select("id,actie,nieuwe_waarde,details,uitgevoerd_door,created_at")
    .eq("id", auditId).eq("actie", "bav_nummer_override").maybeSingle();
  if (!log || log.uitgevoerd_door !== user.id) return json({ error: "niet gevonden" }, 404);
  const { count } = await admin.from("lead_notification_log").select("id", { count: "exact", head: true }).eq("lead_type", "bav-override").contains("metadata", { audit_id: auditId });
  if ((count ?? 0) > 0) return json({ success: true, al_verzonden: true });
  const d = (log.details ?? {}) as Record<string, unknown>;
  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const results = await verstuurInterneMelding(admin, req, "bav-override-melding", {
    leadType: "bav-override",
    soort: "bav_override",
    subject: `BAV-nummer ${log.nieuwe_waarde} bewust dubbel gekoppeld`,
    html: `<p>Er is een BAV-nummer gekoppeld dat al bij een andere klant bekend was (override).</p>
<p><strong>BAV-nummer:</strong> ${esc(log.nieuwe_waarde)}<br><strong>Gekoppeld aan:</strong> ${esc(d.onderneming_naam)}<br>
<strong>Ook bekend bij:</strong> ${esc(d.andere_naam ?? "onbekend")} (Exact-relatiecode ${esc(d.andere_exact_relatie_code ?? "onbekend")}, bron ${esc(d.andere_bron ?? "onbekend")})<br>
<strong>Reden:</strong> ${esc(d.reden)}<br><strong>Door:</strong> ${esc(prof?.full_name ?? user.email)}</p>
<p>Dit is een interne melding. Er is niets naar de klant verstuurd.</p>`,
    metadata: { audit_id: auditId, no_customer_mail: true },
  });
  return json({ success: results.every((r) => r.ok) });
});
