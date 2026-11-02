// @vitest-environment node
// A20-aanvulling 1: selectie, claim (nooit twee mails per adres), mailtekst, reply_to en herinneringskanaal.
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, it, expect, describe } from "vitest";
import { readFileSync } from "node:fs";
import {
  afhaakAfmeldUrl, AFHAAK_AFMELD_ZIN,
  AFHAAK_ONDERWERP, AFHAAK_REPLY_TO, AFHAAK_URL, afhaakTekst, afhaakHtml, afhaakResendBody, afhaakAfzender,
} from "../../supabase/functions/_shared/afhaakHerinnering";
import { bepaalKanaal, attributieRegels } from "../../supabase/functions/_shared/attributie";

const db = new PGlite();
const NU = "2026-11-01T12:00:00Z";
const VANAF = "2026-11-01T00:00:00Z";
const uur = (h: number) => new Date(Date.parse(NU) - h * 3600_000).toISOString();
let n = 0;
async function concept(p: Record<string, unknown> = {}) {
  const id = `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
  const r = { id, created_at: uur(5), laatst_actief_op: uur(3), email: `klant${n}@voorbeeld.nl`, voornaam: "Sam", status: "open", is_test: false, stap: 2, max_stap: 2, ...p };
  const k = Object.keys(r);
  await db.query(`insert into aanvraag_concepten(${k.join(",")}) values(${k.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(r));
  return id;
}
const kandidaten = async () => (await db.query<{ id: string }>("select id from afhaak_herinnering_kandidaten($1)", [NU])).rows.map((r) => r.id);

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE FUNCTION a19_team() RETURNS void LANGUAGE sql AS $$ SELECT $$;
  CREATE TABLE facturatie_config(id int primary key, herinnering_afhaak_vanaf timestamptz);
  CREATE TABLE aanvraag_concepten(id uuid primary key, created_at timestamptz, laatst_actief_op timestamptz, email text, voornaam text, status text, is_test boolean,
    geanonimiseerd_op timestamptz, lead_id uuid, converted_at timestamptz, herinnering_verstuurd_op timestamptz, stap smallint default 1, max_stap smallint);
  CREATE TABLE ondernemingen(id uuid default gen_random_uuid(), factuur_email text);
  CREATE TABLE personen(id uuid default gen_random_uuid(), genormaliseerd_email text, email_weergave text);
  CREATE TABLE leads(id uuid default gen_random_uuid(), email text, type text, is_test boolean default false, created_at timestamptz);
  CREATE TABLE lead_notification_log(lead_type text, recipient text, status text, created_at timestamptz);`);
  const sql = readFileSync("drizzle/migrations/0215_a20_afhaak_herinnering.sql", "utf8");
  await db.exec(sql.slice(sql.indexOf("-- FUNCTIES")));
  // Beveiligingscheck 2-11: stap 2, misbruikrem, afmeldlijst en eenmalige groep.
  await db.exec(readFileSync("drizzle/migrations/0219_afhaak_herinnering_beveiliging.sql", "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(`DELETE FROM aanvraag_concepten; DELETE FROM leads; DELETE FROM lead_notification_log; DELETE FROM facturatie_config; DELETE FROM herinnering_afmeldingen; DELETE FROM ondernemingen; DELETE FROM personen;
  INSERT INTO facturatie_config VALUES (1, '${VANAF}');`);
});

describe("selectie", () => {
  it("neemt een geldig concept van 2 tot 24 uur stil mee", async () => {
    const id = await concept();
    expect(await kandidaten()).toEqual([id]);
  });
  it("schakelaar uit: niets", async () => {
    await concept(); await db.exec("UPDATE facturatie_config SET herinnering_afhaak_vanaf = NULL");
    expect(await kandidaten()).toEqual([]);
  });
  it.each([
    ["testconcept", { is_test: true }],
    ["te vroeg (1 uur stil)", { laatst_actief_op: uur(1) }],
    ["te laat (25 uur stil)", { laatst_actief_op: uur(25), created_at: uur(26) }],
    ["van voor het aanzetmoment", { created_at: "2026-10-31T23:00:00Z" }],
    ["ongeldig e-mailadres", { email: "geen-adres" }],
    ["leeg e-mailadres", { email: null }],
    ["geanonimiseerd", { geanonimiseerd_op: uur(1) }],
    ["omgezet", { status: "omgezet" }],
    ["dubbel", { status: "dubbel" }],
    ["gekoppeld aan lead", { lead_id: "00000000-0000-0000-0000-000000000999" }],
    ["al omgezet", { converted_at: uur(1) }],
    ["al verstuurd", { herinnering_verstuurd_op: uur(1) }],
  ])("sluit uit: %s", async (_, p) => {
    await concept(p);
    expect(await kandidaten()).toEqual([]);
  });
  it("sluit uit als er na het concept een lead met hetzelfde adres (hoofdletterongevoelig) is", async () => {
    await concept({ email: "Sam@Voorbeeld.nl" });
    await db.query("insert into leads(email,type,created_at) values($1,'verzekering_aanvraag',$2)", [" sam@voorbeeld.nl", uur(4)]);
    expect(await kandidaten()).toEqual([]);
  });
  it("een oudere lead van voor het concept sluit niet uit", async () => {
    const id = await concept({ email: "oud@voorbeeld.nl" });
    await db.query("insert into leads(email,type,created_at) values($1,'contact',$2)", ["oud@voorbeeld.nl", uur(100)]);
    expect(await kandidaten()).toEqual([id]);
  });
  it("zelfde e-mail met eerder verstuurde herinnering op een ander concept: uitgesloten", async () => {
    await concept({ email: "zelfde@voorbeeld.nl", herinnering_verstuurd_op: uur(30), created_at: uur(40), laatst_actief_op: uur(39) });
    await concept({ email: "ZELFDE@voorbeeld.nl" });
    expect(await kandidaten()).toEqual([]);
  });
  it("twee open concepten met hetzelfde adres: maar één kandidaat", async () => {
    await concept({ email: "twee@voorbeeld.nl", laatst_actief_op: uur(4) });
    const b = await concept({ email: "twee@voorbeeld.nl", laatst_actief_op: uur(3) });
    expect(await kandidaten()).toEqual([b]);
  });
});

describe("claim: geen dubbele verzending", () => {
  it("tweede claim voor hetzelfde concept of adres faalt", async () => {
    const a = await concept({ email: "c@voorbeeld.nl" });
    const b = await concept({ email: "c@voorbeeld.nl", laatst_actief_op: uur(4) });
    const claim = async (id: string) => (await db.query<{ r: boolean }>("select afhaak_herinnering_claim($1,$2) r", [id, NU])).rows[0].r;
    expect(await claim(a)).toBe(true);
    expect(await claim(a)).toBe(false);
    expect(await claim(b)).toBe(false);
    expect(await kandidaten()).toEqual([]);
  });
});

describe("telling per dag", () => {
  it("telt verstuurd en daarna afgerond", async () => {
    await db.query("insert into lead_notification_log values('afhaak_herinnering','a@v.nl','sent',$1),('afhaak_herinnering','b@v.nl','sent',$1),('afhaak_herinnering','c@v.nl','failed',$1)", [uur(10)]);
    await db.query("insert into leads(email,type,created_at) values('A@v.nl','verzekering_aanvraag',$1)", [uur(5)]);
    const r = (await db.query<any>("select * from afhaak_herinnering_per_dag()")).rows;
    expect(r.length).toBe(1);
    expect(Number(r[0].verstuurd)).toBe(2);
    expect(Number(r[0].daarna_afgerond)).toBe(1);
  });
});

describe("mail", () => {
  it("onderwerp en tekst exact", () => {
    expect(AFHAAK_ONDERWERP).toBe("Je aanvraag bij ZP Zaken staat nog open");
    expect(afhaakTekst("Sam")).toBe(`Hoi Sam,

Je was bezig met je aanvraag voor de BAV + AVB bij ZP Zaken, maar die is nog niet afgerond. Misschien kwam er iets tussen, of liep je ergens tegenaan.

Je kunt je aanvraag hier afmaken: Verder met mijn aanvraag: ${AFHAAK_URL}

Heb je een vraag over de dekking of het formulier? Bel me gerust op 020 - 457 3077 of beantwoord deze mail.

Met vriendelijke groet,
Ellen Baars
ZP Zaken`);
  });
  it("zonder voornaam 'Hoi,'", () => {
    expect(afhaakTekst("  ").startsWith("Hoi,\n")).toBe(true);
    expect(afhaakHtml(null)).toContain(">Hoi,<");
  });
  it("afzender Ellen op het bestaande domein en reply_to Ellen", () => {
    expect(afhaakAfzender("ZP Zaken <info@zpzaken.nl>")).toBe("Ellen Baars | ZP Zaken <info@zpzaken.nl>");
    const b = afhaakResendBody({ from: "ZP Zaken <info@zpzaken.nl>", to: ["x@v.nl"], subject: AFHAAK_ONDERWERP, html: "h" });
    expect(b.reply_to).toBe(AFHAAK_REPLY_TO);
    expect(AFHAAK_REPLY_TO).toBe("ellen.baars@zpzaken.nl");
    expect(b).not.toHaveProperty("attachments");
  });
  it("link zonder persoonsgegevens, met herinnering-utm", () => {
    const u = new URL(AFHAAK_URL);
    expect(u.searchParams.get("utm_source")).toBe("herinnering");
    expect(u.searchParams.get("utm_medium")).toBe("email");
    expect(u.searchParams.get("utm_campaign")).toBe("afhaak");
    expect([...u.searchParams.keys()].sort()).toEqual(["utm_campaign", "utm_medium", "utm_source"]);
    expect(afhaakHtml("Sam")).toContain("Verder met mijn aanvraag</a>");
  });
});

describe("kanaal herinnering", () => {
  it("utm_source=herinnering telt als herinnering en is zichtbaar als Bron", () => {
    expect(bepaalKanaal({ utm_source: "herinnering" })).toBe("herinnering");
    expect(attributieRegels({ utm_source: "herinnering", utm_medium: "email" })[0]).toEqual(["Bron", "Herinneringsmail"]);
    expect(bepaalKanaal({ utm_source: "nieuwsbrief" })).toBe("campagne");
  });
});

describe("beveiligingscheck 2-11: stap, misbruikrem, afmelden", () => {
  it("stap 1 (alleen e-mailadres) krijgt nooit een herinnering", async () => {
    await concept({ stap: 1, max_stap: 1 });
    await concept({ stap: 1, max_stap: null });
    expect(await kandidaten()).toEqual([]);
  });
  it("teruggegaan naar stap 1 na stap 2 telt als stap 2", async () => {
    const id = await concept({ stap: 1, max_stap: 3 });
    expect(await kandidaten()).toEqual([id]);
  });
  it("misbruikrem: maximaal 3 herinneringen per uur per IP", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(await concept({ ip_hash: "ipA" }));
    const claim = async (id: string) => (await db.query<{ r: boolean }>("select afhaak_herinnering_claim($1, now()) r", [id])).rows[0].r;
    // Echte klok voor de rem; venster 2-24 uur ruim genoeg om met de testtijd te rekenen.
    await db.exec("UPDATE aanvraag_concepten SET laatst_actief_op = now() - interval '3 hours', created_at = now() - interval '5 hours'");
    await db.exec("UPDATE facturatie_config SET herinnering_afhaak_vanaf = now() - interval '1 day'");
    const uitslag = [];
    for (const id of ids) uitslag.push(await claim(id));
    expect(uitslag).toEqual([true, true, true, false, false]);
    const ander = await concept({ ip_hash: "ipB", laatst_actief_op: new Date(Date.now() - 3 * 3600_000).toISOString(), created_at: new Date(Date.now() - 5 * 3600_000).toISOString() });
    expect(await claim(ander)).toBe(true);
  });
  it("spamsignaal op dit concept of een ander concept van hetzelfde IP sluit uit", async () => {
    await concept({ spam_signaal: "honeypot" });
    expect(await kandidaten()).toEqual([]);
    await db.exec("DELETE FROM aanvraag_concepten");
    await concept({ ip_hash: "ipS", spam_signaal: "rate_limited", email: "bot@voorbeeld.nl" });
    await concept({ ip_hash: "ipS" });
    expect(await kandidaten()).toEqual([]);
  });
  it("afgemeld adres (hoofdletterongevoelig) krijgt geen herinnering meer", async () => {
    await concept({ email: "Weg@Voorbeeld.nl" });
    await db.exec("INSERT INTO herinnering_afmeldingen(email) VALUES ('weg@voorbeeld.nl')");
    expect(await kandidaten()).toEqual([]);
  });
  it("afmeldlink: onraadbaar token in de link, zin onderaan, rest van de tekst ongewijzigd", () => {
    const token = "a".repeat(64);
    const url = afhaakAfmeldUrl(token);
    expect(url).toBe(`https://zpzaken.nl/afmelden?soort=herinnering&token=${token}`);
    expect(afhaakTekst("Sam", url)).toBe(`${afhaakTekst("Sam")}\n\n${AFHAAK_AFMELD_ZIN} Afmelden: ${url}`);
    expect(afhaakHtml("Sam", url)).toContain(`Wil je deze mail niet meer ontvangen? <a href="${url.replace(/&/g, "&amp;")}"`);
    expect(afhaakHtml("Sam", url)).toContain(">Afmelden</a>");
    const b = afhaakResendBody({ from: "ZP Zaken <info@zpzaken.nl>", to: ["x@v.nl"], subject: AFHAAK_ONDERWERP, html: "h", afmeldUrl: url });
    expect(b.text).toContain(url);
  });
  it("herinnering-afmelden accepteert alleen 64 hex-tekens en schrijft pas bij POST", () => {
    const src = readFileSync("supabase/functions/herinnering-afmelden/index.ts", "utf8");
    expect(src).toContain("/^[a-f0-9]{64}$/");
    expect(src.indexOf('if (req.method === "GET") return json({ status: "geldig" })')).toBeLessThan(src.indexOf('from("herinnering_afmeldingen").upsert'));
    expect(src).not.toContain(`from("review_afmeldingen")`);
    expect(src).not.toContain(`from("suppressed_emails")`);
  });
});

describe("eenmalige groep 26-10 t/m 31-10", () => {
  const eenmalig = async () => (await db.query<{ id: string; stap: number }>("select id, stap from afhaak_eenmalig_kandidaten()")).rows;
  it("neemt ook stap 1 mee, sluit lead/klant/test/eerder gemaild uit", async () => {
    const a = await concept({ created_at: "2026-10-27T10:00:00Z", stap: 1, max_stap: 1, email: "a@voorbeeld.nl" });
    await concept({ created_at: "2026-10-25T10:00:00Z", email: "te-vroeg@voorbeeld.nl" });
    await concept({ created_at: "2026-11-01T10:00:00Z", email: "te-laat@voorbeeld.nl" });
    await concept({ created_at: "2026-10-28T10:00:00Z", email: "Lead@voorbeeld.nl" });
    await db.query("insert into leads(email,type,created_at) values('lead@voorbeeld.nl','contact','2026-01-01')");
    await concept({ created_at: "2026-10-28T10:00:00Z", email: "klant@voorbeeld.nl" });
    await db.query("insert into ondernemingen(factuur_email) values('KLANT@voorbeeld.nl')");
    await concept({ created_at: "2026-10-29T10:00:00Z", email: "test@voorbeeld.nl", is_test: true });
    await concept({ created_at: "2026-10-29T10:00:00Z", email: "gemaild@voorbeeld.nl" });
    await db.query("insert into lead_notification_log values('afhaak_herinnering','gemaild@voorbeeld.nl','sent',now())");
    expect((await eenmalig()).map((r) => r.id)).toEqual([a]);
    expect(Number((await eenmalig())[0].stap)).toBe(1);
    const claim = async (id: string) => (await db.query<{ r: boolean }>("select afhaak_eenmalig_claim($1) r", [id])).rows[0].r;
    expect(await claim(a)).toBe(true);
    expect(await claim(a)).toBe(false);
    expect(await eenmalig()).toEqual([]);
  });
});
