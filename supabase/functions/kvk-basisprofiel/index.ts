// deno-lint-ignore-file no-explicit-any
// KVK Basisprofiel, alleen voor het team (besluit A12). Elke bevraging via _shared/kvk.ts (kostenbewaking).
// modus "status": is de koppeling bruikbaar. modus "lead": knop "KVK-gegevens ophalen" bij een aanvraag.
// modus "verversen": ondernemingen.kvk_*-kolommen. modus "rooktest": hard tegen de KVK-testomgeving, kost niets.
// Geen openbare opzoeking meer: bezoekers krijgen nooit KVK-gegevens.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
import { haalKvkProfiel, kvkBevraagbaar, kvkKolommen, kvkStartdatum, kvkAfwijkingen, KVK_NIET_BESCHIKBAAR } from "../_shared/kvk.ts";
import { requireSupervisor, requireVerzekeringOfSupervisor } from "../_shared/teamAuth.ts";

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const doorgeven = (r: Response) => new Response(r.body, { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const modus = String(body?.modus ?? "");

    if (modus === "opzoeken") return json({ ok: false, reden: "uitgeschakeld", melding: "Opzoeken in het formulier is uitgeschakeld" }, 410);

    if (modus === "status") {
      const auth = await requireVerzekeringOfSupervisor(req, admin);
      if (auth instanceof Response) return doorgeven(auth);
      const { data: sch } = await admin.from("integratie_config").select("enabled").eq("naam", "kvk_api").maybeSingle();
      return json({ sleutel: !!Deno.env.get("KVK_API_KEY"), aan: sch?.enabled === true });
    }

    if (modus === "lead") {
      const auth = await requireVerzekeringOfSupervisor(req, admin);
      if (auth instanceof Response) return doorgeven(auth);
      const id = String(body?.lead_id ?? "");
      if (!UUID.test(id)) return json({ error: "lead_id vereist" }, 400);
      const { data: lead } = await admin.from("leads").select("id,kvk_nummer,kvk_gegevens,kvk_startdatum,kvk_datum_bron,bedrijfsnaam,adres_straat,adres_huisnummer,adres_postcode,adres_plaats,is_test").eq("id", id).maybeSingle();
      if (!lead) return json({ error: "aanvraag niet gevonden" }, 404);
      const kvk = String(lead.kvk_nummer ?? "").replace(/\D/g, "");
      if (!kvkBevraagbaar(kvk)) return json({ ok: false, reden: "ongeldig", melding: "Deze aanvraag heeft geen geldig KVK-nummer" });
      const r = await haalKvkProfiel(admin, kvk, { bron: "beheer", uid: auth.userId, vers: body?.opnieuw === true });
      if (!r.ok) return json({ ok: false, reden: r.reden, melding: r.melding });
      const p = r.profiel;
      const oud = (lead.kvk_gegevens ?? {}) as Record<string, any>;
      const klant = oud.klant_opgave ?? { bedrijfsnaam: lead.bedrijfsnaam, straat: lead.adres_straat, huisnummer: lead.adres_huisnummer, postcode: lead.adres_postcode, plaats: lead.adres_plaats, kvk_startdatum: lead.kvk_datum_bron === "klant" ? lead.kvk_startdatum : null };
      const metAdres = !!p.bezoekadres?.postcode;
      const start = kvkStartdatum(p);
      const gegevens = {
        ...oud, status: "ok", opgehaald_op: r.uit_cache ? (oud.opgehaald_op ?? new Date().toISOString()) : new Date().toISOString(),
        uit_cache: r.uit_cache, profiel: p, klant_opgave: klant,
        afwijkingen: kvkAfwijkingen(klant, { bedrijfsnaam: p.naam, ...(p.bezoekadres ?? {}), kvk_startdatum: start }, metAdres),
      };
      // Tarief blijft ongemoeid: alleen gegevens en (eenmalig) de KVK-startdatum. Ellen beslist met de bestaande knoppen.
      const upd: Record<string, unknown> = { kvk_gegevens: gegevens };
      if (start && lead.kvk_datum_bron !== "kvk_api") { upd.kvk_startdatum = start; upd.kvk_datum_bron = "kvk_api"; }
      const { error } = await admin.from("leads").update(upd).eq("id", id);
      if (error) return json({ ok: false, reden: "fout", melding: error.message }, 500);
      return json({ ok: true, uit_cache: r.uit_cache, opgehaald_op: gegevens.opgehaald_op });
    }

    if (modus === "verversen") {
      const auth = await requireSupervisor(req, admin);
      if (auth instanceof Response) return doorgeven(auth);
      const ids: string[] = Array.isArray(body?.onderneming_ids) ? body.onderneming_ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 25) : [];
      if (!ids.length) return json({ error: "onderneming_ids vereist" }, 400);
      const { data: rows } = await admin.from("ondernemingen").select("id,kvk").in("id", ids);
      const uitkomst: any[] = [];
      for (const o of rows ?? []) {
        if (!kvkBevraagbaar(o.kvk)) { uitkomst.push({ id: o.id, ok: false, melding: "geen geldig KVK-nummer" }); continue; }
        const r = await haalKvkProfiel(admin, o.kvk, { bron: "verversen", uid: auth.userId, vers: body?.vers === true });
        if (!r.ok) {
          if (r.reden !== "uitgeschakeld" && r.reden !== "limiet") await admin.from("ondernemingen").update({ kvk_status: r.reden }).eq("id", o.id);
          uitkomst.push({ id: o.id, ok: false, melding: r.melding }); continue;
        }
        await admin.from("ondernemingen").update(kvkKolommen(r.profiel)).eq("id", o.id);
        uitkomst.push({ id: o.id, ok: true });
      }
      return json({ ok: true, uitkomst });
    }

    if (modus === "rooktest") {
      const auth = await requireSupervisor(req, admin);
      if (auth instanceof Response) return doorgeven(auth);
      const r = await haalKvkProfiel(admin, "69599084", { bron: "rooktest", uid: auth.userId, testomgeving: true });
      return json(r.ok ? { ok: true, omgeving: "test", naam: r.profiel.naam, ingeschreven: r.profiel.datum_inschrijving } : { ok: false, omgeving: "test", reden: r.reden });
    }
    return json({ error: "onbekende modus" }, 400);
  } catch (e) {
    console.error("kvk-basisprofiel fout", (e as Error)?.message);
    return json({ ok: false, reden: "fout", melding: KVK_NIET_BESCHIKBAAR }, 500);
  }
});
