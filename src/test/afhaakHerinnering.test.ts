// @vitest-environment node
// A20-aanvulling 1: selectie, claim (nooit twee mails per adres), mailtekst, reply_to en herinneringskanaal.
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, it, expect, describe } from "vitest";
import { readFileSync } from "node:fs";
import {
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
  const r = { id, created_at: uur(5), laatst_actief_op: uur(3), email: `klant${n}@voorbeeld.nl`, voornaam: "Sam", status: "open", is_test: false, ...p };
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
    geanonimiseerd_op timestamptz, lead_id uuid, converted_at timestamptz, herinnering_verstuurd_op timestamptz);
  CREATE TABLE leads(id uuid default gen_random_uuid(), email text, type text, is_test boolean default false, created_at timestamptz);
  CREATE TABLE lead_notification_log(lead_type text, recipient text, status text, created_at timestamptz);`);
  const sql = readFileSync("drizzle/migrations/0215_a20_afhaak_herinnering.sql", "utf8");
  await db.exec(sql.slice(sql.indexOf("-- FUNCTIES")));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(`DELETE FROM aanvraag_concepten; DELETE FROM leads; DELETE FROM lead_notification_log; DELETE FROM facturatie_config;
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

Je kunt verder waar je gebleven was: Verder met mijn aanvraag: ${AFHAAK_URL}

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
