// deno-lint-ignore-file no-explicit-any
// Eenmalige/handmatige run van de automatische Mijn ZP-uitnodiging over open portaltoegang-aanvragen.
// Alleen x-cron-secret (Vault). Body: { droog: boolean (standaard true), aanvraag_ids?: uuid[] }.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verwerkPortaltoegangAuto } from "../_shared/portaltoegangAuto.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = secret ? await admin.rpc("verify_cron_secret", { p_secret: secret }) : { data: false };
  if (ok !== true) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const droog = body?.droog !== false;
  const ids: string[] = Array.isArray(body?.aanvraag_ids) ? body.aanvraag_ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 200) : [];
  let q = admin.from("klant_service_aanvragen").select("id").eq("type", "portaltoegang").in("status", ["nieuw", "in_behandeling"]).order("created_at");
  if (ids.length) q = q.in("id", ids);
  const { data: rijen, error } = await q.limit(200);
  if (error) return json({ error: error.message }, 500);
  const uitkomsten: any[] = [];
  for (const r of rijen ?? []) {
    try { uitkomsten.push(await verwerkPortaltoegangAuto(admin, req, r.id, { droog, origin: "https://zpzaken.nl" })); }
    catch (e: any) { uitkomsten.push({ aanvraag_id: r.id, besluit: "mislukt", reden: e?.message }); }
  }
  const tel = (b: string) => uitkomsten.filter((u) => u.besluit === b).length;
  return json({ ok: true, droog, totaal: uitkomsten.length, uitgenodigd: tel("uitgenodigd"), geen_match: tel("geen_match"), mislukt: tel("mislukt"), overgeslagen: tel("overgeslagen"), uitkomsten });
});
