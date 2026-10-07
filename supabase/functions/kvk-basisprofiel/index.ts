// deno-lint-ignore-file no-explicit-any
// KVK Basisprofiel + Vestigingsprofiel.
// modus "opzoeken": openbaar (aanvraagformulier), rate limit per IP, alleen niet-afgeschermde gegevens.
// modus "verversen": supervisor/admin met 2FA; schrijft alleen ondernemingen.kvk_*-kolommen, nooit naam/adres of Exact.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { haalKvkProfiel, ipHash, kvkGeldig, kvkKolommen, kvkStartdatum, KVK_NIET_BESCHIKBAAR } from "../_shared/kvk.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const modus = String(body?.modus ?? "opzoeken");

    if (modus === "status") return json({ beschikbaar: !!Deno.env.get("KVK_API_KEY") });

    if (modus === "opzoeken") {
      const kvk = String(body?.kvk_nummer ?? "").replace(/\D/g, "");
      if (!kvkGeldig(kvk)) return json({ ok: false, reden: "ongeldig", melding: "KVK-nummer moet 8 cijfers zijn" }, 400);
      const r = await haalKvkProfiel(admin, kvk, { bron: "formulier", ip_hash: await ipHash(req), limietPerUur: 20 });
      if (!r.ok) return json({ ok: false, reden: r.reden, melding: r.melding });
      const p = r.profiel;
      return json({ ok: true, profiel: {
        kvk_nummer: p.kvk_nummer, naam: p.naam, handelsnamen: p.handelsnamen, rechtsvorm: p.rechtsvorm,
        bezoekadres: p.bezoekadres, adres_afgeschermd: p.adres_afgeschermd, startdatum: kvkStartdatum(p),
      } });
    }

    if (modus === "verversen") {
      const auth = await requireSupervisor(req, admin);
      if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const ids: string[] = Array.isArray(body?.onderneming_ids) ? body.onderneming_ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 25) : [];
      if (!ids.length) return json({ error: "onderneming_ids vereist" }, 400);
      if (!Deno.env.get("KVK_API_KEY")) return json({ ok: false, reden: "geen_sleutel", melding: KVK_NIET_BESCHIKBAAR });
      const { data: rows } = await admin.from("ondernemingen").select("id,kvk").in("id", ids);
      const uitkomst: any[] = [];
      for (const o of rows ?? []) {
        if (!kvkGeldig(o.kvk)) { uitkomst.push({ id: o.id, ok: false, melding: "geen geldig KVK-nummer" }); continue; }
        const r = await haalKvkProfiel(admin, o.kvk, { bron: "verversen", uid: auth.userId, vers: body?.vers === true });
        if (!r.ok) {
          await admin.from("ondernemingen").update({ kvk_status: r.reden }).eq("id", o.id);
          uitkomst.push({ id: o.id, ok: false, melding: r.melding }); continue;
        }
        await admin.from("ondernemingen").update(kvkKolommen(r.profiel)).eq("id", o.id);
        uitkomst.push({ id: o.id, ok: true });
      }
      return json({ ok: true, uitkomst });
    }
    return json({ error: "onbekende modus" }, 400);
  } catch (e) {
    console.error("kvk-basisprofiel fout", (e as Error)?.message);
    return json({ ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR }, 500);
  }
});
