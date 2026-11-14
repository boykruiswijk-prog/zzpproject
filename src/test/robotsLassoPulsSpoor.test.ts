import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bouwOpvolgMail, adminLink, OPVOLGER_ONTVANGERS_STANDAARD, type OpvolgItem } from "../../supabase/functions/_shared/opvolger";
import { beoordeelMail, beoordeelExact, beoordeelPagina, isRood, teVerwijderen, pulsRood } from "../../supabase/functions/_shared/hartslag";
import { AI_TEAM, ROBOTNAMEN, bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";

const migratie = readFileSync("drizzle/migrations/0244_robots_lasso_puls.sql", "utf8");
const hartslagFn = readFileSync("supabase/functions/hartslag/index.ts", "utf8");
const item = (i: number, signaal: 1 | 2 = 1): OpvolgItem => ({ soort: i % 2 ? "terugbel" : "concept", id: `00000000-0000-0000-0000-00000000000${i}`, signaal, uren_open: 3 + i, stap: 2, pakket: "BAV + AVB" });

describe("A30 Lasso / Opvolger", () => {
  it("nooit klantmail: alleen de interne route naar Ellen en info@", () => {
    expect(hartslagFn).toContain("verstuurInterneMelding");
    expect(hartslagFn).not.toMatch(/api\.resend\.com/);
    expect(OPVOLGER_ONTVANGERS_STANDAARD).toEqual(["ellen.baars@zpzaken.nl", "info@zpzaken.nl"]);
    expect(readFileSync("supabase/functions/_shared/interneMelding.ts", "utf8")).toContain('opvolger: ["ellen.baars@zpzaken.nl", "info@zpzaken.nl"]');
  });
  it("bundelt per ronde: één mail voor alle items, geen mail zonder items", () => {
    expect(bouwOpvolgMail([])).toBeNull();
    const m = bouwOpvolgMail([item(1), item(2), item(3, 2)])!;
    expect(m.subject).toBe("Lasso: 3 items opvolgen");
    expect(m.html.match(/<tr><td>/g)).toHaveLength(3);
    expect(m.html).toContain("(tweede signaal)");
    expect(m.html).toContain(adminLink(item(2)));
    expect(adminLink(item(2))).toContain("/admin/afgehaakt?record=");
    expect(adminLink(item(1))).toContain("/admin/leads/");
  });
  it("maximaal twee signalen per item", () => {
    expect(migratie).toContain("ON CONFLICT (item_soort,item_id) DO NOTHING");
    expect(migratie).toContain("s.signaal_2_op IS NULL");
    expect(migratie).toContain("interval '24 hours'");
    expect(migratie).toMatch(/PRIMARY KEY \(item_soort, item_id\)/);
  });
  it("test, spam, dubbel en afgerond zijn uitgesloten, 2 uur tot 14 dagen", () => {
    for (const s of ["NOT coalesce(c.is_test,false)", "c.spam_signaal IS NULL", "c.dubbel_lead_id IS NULL", "c.lead_id IS NULL", "c.afgerond_op IS NULL", "c.opgevolgd_op IS NULL", "NOT coalesce(l.is_test,false)", "interval '2 hours'", "interval '14 days'"])
      expect(migratie).toContain(s);
  });
  it("returnwaarde ronde zonder persoonsgegevens", () => {
    const ronde = migratie.slice(migratie.indexOf("FUNCTION public.opvolger_ronde"), migratie.indexOf("FUNCTION public.opvolg_overzicht"));
    expect(ronde).not.toMatch(/'naam'|email|telefoon/);
  });
});

describe("A31 Puls / Hartslag", () => {
  it("formulier-ping maakt niets aan: antwoord vóór elke database- of mailstap", () => {
    const src = readFileSync("supabase/functions/submit-public-form/index.ts", "utf8");
    const ping = src.indexOf("body.ping === true");
    expect(ping).toBeGreaterThan(0);
    expect(ping).toBeLessThan(src.indexOf("return await bewaarConcept(req"));
    expect(ping).toBeLessThan(src.indexOf("createClient(", src.indexOf("Deno.serve(")));
    expect(hartslagFn).toContain("JSON.stringify({ ping: true })");
  });
  it("rood bij twee fouten op rij, niet bij één", () => {
    expect(isRood([{ ok: false }, { ok: false }])).toBe(true);
    expect(isRood([{ ok: false }, { ok: true }])).toBe(false);
    expect(isRood([{ ok: false }])).toBe(false);
    expect(pulsRood([{ rood: false }, { rood: true }])).toBe(true);
    expect(pulsRood([])).toBe(false);
  });
  it("opruimen na 14 dagen", () => {
    const nu = new Date("2026-11-20T12:00:00Z");
    expect(teVerwijderen("2026-11-06T11:00:00Z", nu)).toBe(true);
    expect(teVerwijderen("2026-11-07T12:00:00Z", nu)).toBe(false);
    expect(migratie).toContain("gemeten_op < now() - interval '14 days'");
  });
  it("mail, Exact en pagina's beoordelen", () => {
    expect(beoordeelMail([{ recipient_email: "a@b.nl", template_name: "t", status: "failed", created_at: "2026-11-05T10:00:00Z" }]).ok).toBe(false);
    expect(beoordeelMail([{ recipient_email: "a@b.nl", template_name: "t", status: "failed", created_at: "2026-11-05T10:00:00Z" },
      { recipient_email: "a@b.nl", template_name: "t", status: "sent", created_at: "2026-11-05T10:05:00Z" }]).ok).toBe(true);
    expect(beoordeelExact([{ status: "error", created_at: "2026-11-05T10:00:00Z" }]).ok).toBe(false);
    expect(beoordeelExact([{ status: "error", created_at: "2026-11-05T10:00:00Z" }, { status: "success", created_at: "2026-11-05T10:10:00Z" }]).ok).toBe(true);
    expect(beoordeelPagina("/", 200, "<h1>Zorgeloos ondernemen</h1>", "Zorgeloos ondernemen").ok).toBe(true);
    expect(beoordeelPagina("/", 500, "", "x").reden).toBe("status 500");
  });
});

describe("A29-aanvulling: 16 robots op het scherm", () => {
  it("vier nieuwe robots met naam en functie", () => {
    expect(AI_TEAM).toHaveLength(16);
    expect(ROBOTNAMEN).toMatchObject({ opvolger: "Lasso", hartslag: "Puls", bronnen: "Spoor", bing: "Baken" });
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: "2026-11-05", data: { agents: [] } } } }).ai_team;
    expect(t.find((a) => a.robotnaam === "Lasso")).toMatchObject({ naam: "Opvolger", taak: "Zorgt dat elke aanvraag wordt opgevolgd" });
    expect(t.find((a) => a.robotnaam === "Baken")?.naam).toBe("Bing AI-zichtbaarheid");
  });
  it("status uit machine_activiteit en Puls rood bij hartslag_status rood", () => {
    const t = bouwSchermPayload({ marketing: { ai_team: { dag: "2026-11-05", data: { agents: [] } } },
      versheid: { agent_laatst: [{ sleutel: "opvolger", tijd: "2026-11-05T10:00:00Z" }, { sleutel: "hartslag", tijd: "2026-11-05T10:00:00Z" }] },
      hartslag_status: [{ onderdeel: "pagina /", rood: true }] }).ai_team;
    expect(t.find((a) => a.robotnaam === "Lasso")?.status).toBe("klaar");
    expect(t.find((a) => a.robotnaam === "Puls")?.status).toBe("fout");
  });
  it("besluit 12-11: één rustige regel per robot met functie, run en fouten bovenaan", () => {
    const src = readFileSync("src/pages/Scherm.tsx", "utf8");
    const paneel = src.slice(src.indexOf("function PaneelAiTeam"), src.indexOf("const workerKleur"));
    expect(paneel).toContain("aiTeamVolgorde(d.ai_team ?? [])");
    expect(paneel).toContain('data-testid="ai-team-lijst"');
    expect(paneel).toContain("flex-col justify-start");
    expect(paneel).not.toMatch(/tweeKolommen|grid-cols-2/);
    expect(paneel.match(/data-testid="ai-team-regel"/g)).toHaveLength(1);
    expect(paneel).toContain("team.map((a, i)");
    for (const veld of ["a.robotnaam", "a.functie", "a.reden", "a.laatste_run", "var(--s-rood)"]) expect(paneel).toContain(veld);
  });
});
