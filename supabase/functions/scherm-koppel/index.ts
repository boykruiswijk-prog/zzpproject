import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { clientIp } from "../_shared/antiSpam.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

// Apparaatkoppeling voor /tv. Tv: "aanvragen" en "status" (anoniem, met geheim in het geheugen).
// Beheer (supervisor/admin met 2FA): "koppelen", "lijst", "intrekken". Elke beheeractie gaat naar sensitive_audit_log.
const CODE_TEKENS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_VERZOEKEN_PER_UUR = 20;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const willekeurig = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const b64url = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
function nieuweCode() {
  const r = willekeurig(6);
  return [...r].map((x) => CODE_TEKENS[x % CODE_TEKENS.length]).join("");
}

const Body = z.discriminatedUnion("actie", [
  z.object({ actie: z.literal("aanvragen") }),
  z.object({ actie: z.literal("status"), id: z.string().uuid(), geheim: z.string().min(20).max(100) }),
  z.object({ actie: z.literal("koppelen"), koppelcode: z.string().trim().toUpperCase().regex(/^[A-HJKMNP-Z2-9]{6}$/), naam: z.string().trim().min(1).max(80) }),
  z.object({ actie: z.literal("lijst") }),
  z.object({ actie: z.literal("intrekken"), id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let ruw: unknown;
  try { ruw = await req.json(); } catch { return json({ error: "ongeldig" }, 400); }
  const p = Body.safeParse(ruw);
  if (!p.success) return json({ error: "ongeldig" }, 400);
  const b = p.data;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const nu = new Date();

  try {
    if (b.actie === "aanvragen") {
      const ip = clientIp(req);
      const sinds = new Date(nu.getTime() - 3_600_000).toISOString();
      const { count } = await admin.from("form_rate_limit").select("id", { count: "exact", head: true })
        .eq("ip", ip).eq("kind", "scherm-koppel").gte("created_at", sinds);
      if ((count ?? 0) >= MAX_VERZOEKEN_PER_UUR) return json({ error: "te_veel_pogingen" }, 429);
      await admin.from("form_rate_limit").insert({ ip, kind: "scherm-koppel" });

      const geheim = b64url(willekeurig(32));
      for (let poging = 0; poging < 5; poging++) {
        const koppelcode = nieuweCode();
        const { count: bezet } = await admin.from("scherm_koppelverzoeken").select("id", { count: "exact", head: true })
          .eq("koppelcode", koppelcode).gt("verloopt_op", nu.toISOString()).is("goedgekeurd_op", null);
        if (bezet) continue;
        const { data, error } = await admin.from("scherm_koppelverzoeken")
          .insert({ koppelcode, apparaat_geheim_hash: await sha256(geheim) }).select("id, verloopt_op").single();
        if (error) throw new Error(error.message);
        return json({ id: data.id, koppelcode, geheim, verloopt_op: data.verloopt_op });
      }
      return json({ error: "probeer_opnieuw" }, 503);
    }

    if (b.actie === "status") {
      const { data: v } = await admin.from("scherm_koppelverzoeken").select("*").eq("id", b.id).maybeSingle();
      if (!v || v.apparaat_geheim_hash !== await sha256(b.geheim)) return json({ status: "onbekend" }, 404);
      if (!v.goedgekeurd_op || !v.apparaat_id) {
        return json({ status: new Date(v.verloopt_op) <= nu ? "verlopen" : "wachten" });
      }
      const { data: app } = await admin.from("scherm_apparaten").select("id, ingetrokken_op, laatst_gezien_op").eq("id", v.apparaat_id).single();
      if (!app || app.ingetrokken_op) return json({ status: "verlopen" });
      // Token alleen uitgeven tot het apparaat voor het eerst data heeft opgehaald; daarna niet opnieuw.
      if (app.laatst_gezien_op) return json({ status: "verlopen" });
      const token = b64url(willekeurig(32));
      const { error } = await admin.from("scherm_apparaten").update({ token_hash: await sha256(token) }).eq("id", app.id).is("laatst_gezien_op", null);
      if (error) throw new Error(error.message);
      return json({ status: "gekoppeld", token });
    }

    // Beheeracties
    const auth = await requireSupervisor(req, admin);
    if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user } } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    }).auth.getUser();
    const audit = (actie: string, target_id: string | null, details: Record<string, unknown>) =>
      admin.from("sensitive_audit_log").insert({ target_table: "scherm_apparaten", target_id, actie, uitgevoerd_door: auth.userId, uitgevoerd_door_email: user?.email ?? null, details });

    if (b.actie === "lijst") {
      const { data: rijen, error } = await admin.from("scherm_apparaten")
        .select("id, naam, gekoppeld_door, gekoppeld_op, laatst_gezien_op, ingetrokken_op").order("gekoppeld_op", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = [...new Set((rijen ?? []).map((r) => r.gekoppeld_door).filter(Boolean))] as string[];
      const { data: profielen } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const namen = new Map((profielen ?? []).map((x) => [x.id, x.full_name]));
      return json({ apparaten: (rijen ?? []).map((r) => ({ ...r, gekoppeld_door_naam: r.gekoppeld_door ? namen.get(r.gekoppeld_door) ?? null : null })) });
    }

    if (b.actie === "koppelen") {
      const { data: v } = await admin.from("scherm_koppelverzoeken").select("id, verloopt_op, goedgekeurd_op")
        .eq("koppelcode", b.koppelcode).is("goedgekeurd_op", null).order("aangemaakt_op", { ascending: false }).limit(1).maybeSingle();
      if (!v || new Date(v.verloopt_op) <= nu) {
        await audit("scherm_koppelen_geweigerd", null, { reden: v ? "verlopen" : "onbekende_code" });
        return json({ error: v ? "verlopen" : "onbekend" }, 400);
      }
      const { data: app, error } = await admin.from("scherm_apparaten").insert({ naam: b.naam, gekoppeld_door: auth.userId }).select("id").single();
      if (error) throw new Error(error.message);
      const { data: bijgewerkt } = await admin.from("scherm_koppelverzoeken").update({ goedgekeurd_op: nu.toISOString(), apparaat_id: app.id })
        .eq("id", v.id).is("goedgekeurd_op", null).select("id");
      if (!bijgewerkt?.length) {
        await admin.from("scherm_apparaten").update({ ingetrokken_op: nu.toISOString() }).eq("id", app.id);
        return json({ error: "verlopen" }, 400);
      }
      await audit("scherm_gekoppeld", app.id, { naam: b.naam, koppelverzoek_id: v.id });
      return json({ ok: true, id: app.id });
    }

    if (b.actie === "intrekken") {
      const { data: rij } = await admin.from("scherm_apparaten").update({ ingetrokken_op: nu.toISOString() })
        .eq("id", b.id).is("ingetrokken_op", null).select("id, naam");
      if (!rij?.length) return json({ error: "niet_gevonden" }, 404);
      await audit("scherm_ingetrokken", b.id, { naam: rij[0].naam });
      return json({ ok: true });
    }
    return json({ error: "ongeldig" }, 400);
  } catch (e) {
    console.error("scherm-koppel", e instanceof Error ? e.message : "onbekend");
    return json({ error: "tijdelijk_niet_beschikbaar" }, 503);
  }
});
