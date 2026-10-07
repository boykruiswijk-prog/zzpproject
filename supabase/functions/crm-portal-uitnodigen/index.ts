// deno-lint-ignore-file no-explicit-any
// Individuele uitnodiging voor Mijn ZP vanaf de klantkaart (geen bulk).
// "voorbeeld": alleen de mail tonen; "versturen": account aanmaken (zonder wachtwoord), magic link mailen,
// notitie in de tijdlijn. Ontvanger moet de persoon-e-mail of factuur-e-mail van deze onderneming zijn.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { safeAppOrigin } from "../_shared/company.ts";
import { buildInviteHtml, ensurePortalUser, generateMagicLink, sendPortalMail } from "../_shared/portalAccess.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const uid = (await userClient.auth.getUser()).data.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: mag } = await userClient.rpc("mag_crm_beeindigen", { _uid: uid });
    if (mag !== true) return json({ error: "forbidden" }, 403);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const ondId = String(body?.onderneming_id ?? "");
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!UUID.test(ondId)) return json({ error: "onderneming_id vereist" }, 400);
    const { data: o } = await admin.from("ondernemingen").select("id,naam,factuur_email,is_test").eq("id", ondId).maybeSingle();
    if (!o) return json({ error: "onderneming niet gevonden" }, 404);
    const { data: po } = await admin.from("persoon_onderneming").select("personen(id,voornaam,email_weergave)").eq("onderneming_id", ondId);
    const personen = ((po ?? []) as any[]).map((x) => x.personen).filter(Boolean);
    const opties = [
      ...personen.filter((p) => p.email_weergave).map((p) => ({ email: String(p.email_weergave).toLowerCase(), soort: "persoon", voornaam: p.voornaam, persoon_id: p.id })),
      ...(o.factuur_email ? [{ email: String(o.factuur_email).toLowerCase(), soort: "factuur", voornaam: null, persoon_id: null }] : []),
    ];
    if (body?.modus === "opties") return json({ ok: true, opties });

    // Vanuit een portaltoegang-aanvraag: adres = aanvrager, aanvraag moet aan deze klant gekoppeld zijn.
    const aanvraagId = body?.aanvraag_id ? String(body.aanvraag_id) : null;
    let aanvraag: any = null;
    if (aanvraagId) {
      if (!UUID.test(aanvraagId)) return json({ error: "aanvraag_id ongeldig" }, 400);
      const { data: a } = await admin.from("klant_service_aanvragen").select("id,type,email,status,onderneming_id,details,voornaam").eq("id", aanvraagId).maybeSingle();
      if (!a || a.type !== "portaltoegang") return json({ error: "portaltoegang-aanvraag niet gevonden" }, 404);
      if (a.onderneming_id !== ondId) return json({ error: "koppel de aanvraag eerst aan deze klant" }, 400);
      if (a.status === "afgerond") return json({ error: "aanvraag is al afgerond" }, 400);
      if (String(a.email).toLowerCase() !== email) return json({ error: "adres moet het adres van de aanvrager zijn" }, 400);
      aanvraag = a;
    }
    let keuze = opties.find((x) => x.email === email);
    const handmatig = !keuze && !!aanvraag;
    if (handmatig) {
      // Adres staat nog niet bij de klant: wordt bij verlenen als contactpersoon vastgelegd (RPC portaltoegang_verlenen).
      keuze = { email, soort: "aanvrager", voornaam: aanvraag.voornaam || null, persoon_id: null };
    }
    if (!keuze) return json({ error: "kies een e-mailadres van deze klant" }, 400);
    if (o.is_test && !email.endsWith("@zpzaken.nl")) return json({ error: "testrecord: alleen @zpzaken.nl" }, 400);
    const origin = safeAppOrigin(req.headers.get("origin"));

    if (body?.modus !== "versturen") {
      return json({ ok: true, voorbeeld: true, aan: email, bekend_bij_klant: !handmatig, klantnaam: o.naam, onderwerp: "Welkom bij Mijn ZP", html: buildInviteHtml("#voorbeeld", keuze.voornaam, origin) });
    }
    const { userId, created } = await ensurePortalUser(admin, email, keuze.voornaam);
    let vastgelegd: any = null;
    if (aanvraag) {
      // Contactpersoon, polissen, aanvraagstatus en log in één transactie, uitgevoerd als het teamlid.
      const { data: r, error: rErr } = await userClient.rpc("portaltoegang_verlenen", { _aanvraag_id: aanvraag.id, _portal_user_id: userId, _user_created: created });
      if (rErr) return json({ error: rErr.message }, 400);
      vastgelegd = r;
    }
    const link = await generateMagicLink(admin, email, `${origin}/portal`);
    const res = await sendPortalMail(admin, req, "crm-portal-uitnodigen", {
      to: email, subject: "Welkom bij Mijn ZP", html: buildInviteHtml(link, keuze.voornaam, origin),
      leadType: "portal_invite", leadId: null, metadata: { onderneming_id: ondId, uitgevoerd_door: uid, soort: keuze.soort, aanvraag_id: aanvraagId, contactpersoon: vastgelegd?.contactpersoon ?? null },
    });
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", uid).maybeSingle();
    const naam = prof?.full_name ?? "teamlid";
    if (res.sent && !aanvraag) {
      await admin.from("crm_notities").insert({ onderneming_id: ondId, persoon_id: keuze.persoon_id, soort: "overig", is_test: o.is_test,
        tekst: `Uitgenodigd voor Mijn ZP op ${email} (${keuze.soort === "factuur" ? "factuur-e-mail" : "persoon-e-mail"}) door ${naam}.${created ? " Account aangemaakt." : ""}`,
        aangemaakt_door: uid, aangemaakt_door_naam: naam, details: { soort: "portal_uitnodiging", email, user_created: created } });
    }
    return res.sent ? json({ ok: true, aan: res.recipient, user_created: created, ...(vastgelegd ?? {}) })
      : json({ error: res.error ?? "verzenden mislukt", toegang_vastgelegd: !!vastgelegd }, 502);
  } catch (e: any) {
    console.error("crm-portal-uitnodigen", e?.message);
    return json({ error: e?.message ?? "onbekende fout" }, 500);
  }
});
