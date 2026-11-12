// Mijn ZP-zelfservice "Mijn onderneming wijzigt van rechtsvorm" (besluit Boy 12-11-2026 11:39).
// Alleen ingelogde klant met een eigen geldige polis. Maakt één verzoek voor het team (status nieuw = te beoordelen);
// verandert geen polis, contract, factuur of Exact en verstuurt geen mail. Machtiging via de bestaande SEPA-bewijsflow.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { z } from "npm:zod@3.25.76";
import { isTestInzending } from "../_shared/testMarkering.ts";
import { normaliseerAdres } from "../_shared/adresNormalisatie.ts";
import { bouwMachtigingData, incassantIdOntbreekt, legBewijsVast, KLANTMELDING_INCASSANT_ONTBREEKT } from "../_shared/sepaBewijs.ts";
import { isUuid, isValidIban, redenBav } from "../_shared/sepaMachtiging.ts";
import { datumsFout, laatsteDagOud, machtigingFout, nieuweOndernemingFout, richting } from "../_shared/rechtsvormwijziging.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fout = (melding: string, status = 400) => json({ error: "validation", melding }, status);

const tekst = (max: number) => z.string().trim().max(max);
const Body = z.object({
  aanvraag_id: z.string().refine(isUuid),
  polis_id: z.string().refine(isUuid),
  einddatum: tekst(10), ingangsdatum: tekst(10),
  nieuw: z.object({ naam: tekst(200), kvk: tekst(20), rechtsvorm: tekst(20), straat: tekst(120), huisnummer: tekst(20), postcode: tekst(12), plaats: tekst(120), land: tekst(60) }),
  nieuwe_rekening: z.boolean(),
  iban: tekst(40).optional().default(""),
  rekeninghouder: tekst(200).optional().default(""),
  sepa_akkoord: z.boolean().optional().default(false),
  client_akkoord_op: tekst(40).nullable().optional(),
  pagina_url: tekst(1000).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "login_vereist" }, 401);
    const userClient = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "login_vereist" }, 401);
    const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: user.id });
    if (isTeam === true) return new Response(JSON.stringify({ error: "medewerker", melding: "Je bent ingelogd als medewerker. Leg een rechtsvormwijziging vast via de klantkaart in het beheer." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const raw = await req.text();
    if (raw.length > 20_000) return fout("Verzoek te groot.", 413);
    const p = Body.safeParse(JSON.parse(raw || "{}"));
    if (!p.success) return fout("Controleer de ingevulde gegevens.");
    const b = p.data;

    const { data: polis } = await admin.from("policies").select("id,certificate_number,status,onderneming_id,lead_id,user_id").eq("id", b.polis_id).maybeSingle();
    if (!polis || polis.user_id !== user.id || polis.status !== "geldig") return fout("Deze polis hoort niet bij je account of is niet meer actief.", 403);
    const { data: lead } = polis.lead_id ? await admin.from("leads").select("voornaam,achternaam,email,telefoon,gekoppeld_onderneming_id").eq("id", polis.lead_id).maybeSingle() : { data: null };
    const vanId = polis.onderneming_id ?? lead?.gekoppeld_onderneming_id ?? null;
    if (!vanId) return fout("We kunnen je huidige onderneming niet vinden. Bel ons, dan regelen we het samen.");
    const { data: van } = await admin.from("ondernemingen").select("id,naam,kvk,rechtsvorm").eq("id", vanId).maybeSingle();
    if (!van) return fout("We kunnen je huidige onderneming niet vinden. Bel ons, dan regelen we het samen.");

    const nieuw = { ...normaliseerAdres(b.nieuw), naam: b.nieuw.naam, kvk: b.nieuw.kvk.replace(/\D/g, ""), rechtsvorm: b.nieuw.rechtsvorm, land: b.nieuw.land || "Nederland" };
    const f = datumsFout(b.einddatum, b.ingangsdatum) ?? nieuweOndernemingFout(nieuw, van.kvk)
      ?? machtigingFout({ nieuweRekening: b.nieuwe_rekening, ibanGeldig: isValidIban(b.iban), rekeninghouder: b.rekeninghouder, akkoord: b.sepa_akkoord });
    if (f) return fout(f);

    const { count: open } = await admin.from("klant_service_aanvragen").select("id", { count: "exact", head: true })
      .eq("type", "rechtsvormwijziging").in("status", ["nieuw", "in_behandeling"]).eq("details->>polis_id", polis.id);
    if ((open ?? 0) > 0) return fout("Er staat al een verzoek voor deze polis open. Wij nemen contact met je op.", 409);
    const { data: bestaat } = await admin.from("klant_service_aanvragen").select("id").eq("id", b.aanvraag_id).maybeSingle();
    if (bestaat) return fout("Dit verzoek is al verstuurd.", 409);

    let bewijs: { id: string; mandaatkenmerk: string } | null = null;
    if (b.nieuwe_rekening) {
      if (incassantIdOntbreekt()) return fout(KLANTMELDING_INCASSANT_ONTBREEKT, 503);
      const data = bouwMachtigingData({ type: "doorlopend", bronId: b.aanvraag_id, reden: redenBav(), debiteurNaam: b.rekeninghouder,
        debiteurAdres: { straat: nieuw.straat, huisnummer: nieuw.huisnummer, postcode: nieuw.postcode, plaats: nieuw.plaats, land: nieuw.land }, iban: b.iban });
      bewijs = await legBewijsVast(admin, req, { dienst: "bav", bronTabel: "klant_service_aanvragen", bronId: b.aanvraag_id, data, clientAkkoordOp: b.client_akkoord_op ?? null, paginaUrl: b.pagina_url ?? null });
    }

    const email = String(lead?.email ?? user.email ?? "").toLowerCase();
    const { error } = await admin.from("klant_service_aanvragen").insert({
      id: b.aanvraag_id, type: "rechtsvormwijziging", status: "nieuw",
      voornaam: lead?.voornaam || "-", achternaam: lead?.achternaam || "-", email, telefoon: lead?.telefoon || "-",
      polisnummer: polis.certificate_number ?? "-", user_id: user.id, geverifieerd: true, onderneming_id: van.id,
      is_test: isTestInzending(email),
      details: {
        polis_id: polis.id, einddatum: b.einddatum, ingangsdatum: b.ingangsdatum, laatste_dekkingsdag_oud: laatsteDagOud(b.ingangsdatum),
        huidige_onderneming: { id: van.id, naam: van.naam, kvk: van.kvk, rechtsvorm: van.rechtsvorm },
        richting: richting(van.rechtsvorm, nieuw.rechtsvorm), nieuw,
        nieuwe_rekening: b.nieuwe_rekening, mandaatkenmerk: bewijs?.mandaatkenmerk ?? null, sepa_bewijs_id: bewijs?.id ?? null,
      },
      koppeling_details: { voorgestelde_koppeling: { vorige_onderneming_id: van.id, nieuwe_kvk: nieuw.kvk } },
    });
    if (error) { console.error("insert rechtsvormwijziging", error.message); return json({ error: "db_error" }, 500); }
    return json({ success: true, id: b.aanvraag_id });
  } catch (e) {
    console.error("klant-rechtsvormwijziging", e instanceof Error ? e.message : e);
    return json({ error: "server_error" }, 500);
  }
});
