// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { aanvraagJaarpremie, berekenDagomzet, dagomzetWeergave, amsterdamDag } from "../../supabase/functions/_shared/dagomzet";
import { bavPakketten } from "@/data/bavPakketten";
import { jaarpremie } from "@/lib/tracking";

describe("Dagomzet A8-aanvulling", () => {
  it("jaarpremie per pakket gelijk aan de conversiewaarde uit bavPakketten", () => {
    for (const p of bavPakketten) expect(aanvraagJaarpremie(p.id, "standaard")).toBe(jaarpremie(p));
    expect(aanvraagJaarpremie("maandelijks", "standaard")).toBe(660);
    expect(aanvraagJaarpremie("jaarlijks", "standaard")).toBe(600);
    expect(aanvraagJaarpremie("jaarlijks-cyber", "standaard")).toBe(850);
    expect(aanvraagJaarpremie("maandelijks-cyber", "standaard")).toBe(990);
  });
  it("startersprijs: maand 45 x 12, jaar 495, met cyber erbovenop", () => {
    expect(aanvraagJaarpremie("maandelijks", "starter")).toBe(540);
    expect(aanvraagJaarpremie("jaarlijks", "starter")).toBe(495);
    expect(aanvraagJaarpremie("jaarlijks-cyber", "starter")).toBe(745);
    expect(aanvraagJaarpremie("maandelijks-cyber", "starter")).toBe(870);
  });
  it("som en aantal; onbekend pakket telt mee als aanvraag zonder bedrag", () => {
    const nu = new Date("2026-11-05T10:00:00Z");
    const d = berekenDagomzet([{ pakket: "maandelijks", tarief_type: "standaard" }, { pakket: "jaarlijks", tarief_type: "standaard" }, { pakket: "", tarief_type: null }], nu);
    expect(d).toEqual({ dag: "2026-11-05", bedrag: 1260, aantal: 3 });
    expect(berekenDagomzet([], nu)).toEqual({ dag: "2026-11-05", bedrag: 0, aantal: 0 });
  });
  it("reset op de dag-grens in Amsterdam, niet in UTC", () => {
    expect(amsterdamDag(new Date("2026-11-05T22:59:00Z"))).toBe("2026-11-05");
    expect(amsterdamDag(new Date("2026-11-05T23:00:00Z"))).toBe("2026-11-06");
    const d = { dag: "2026-11-05", bedrag: 1260, aantal: 2 };
    expect(dagomzetWeergave(d, new Date("2026-11-05T22:59:00Z"))).toEqual({ bedrag: 1260, aantal: 2 });
    expect(dagomzetWeergave(d, new Date("2026-11-05T23:00:30Z"))).toEqual({ bedrag: 0, aantal: 0 });
    expect(dagomzetWeergave(null)).toEqual({ bedrag: 0, aantal: 0 });
  });
  it("SQL telt volgens tel_aanvraag_cohort (geen tests, ontdubbeld) en alleen vandaag, zonder persoonsvelden", () => {
    const sql = readFileSync("drizzle/migrations/0248_scherm_dagomzet.sql", "utf8");
    expect(sql).toMatch(/FROM public\.tel_aanvraag_cohort\(\) c/);
    expect(sql).toMatch(/c\.dag = \(now\(\) AT TIME ZONE 'Europe\/Amsterdam'\)::date/);
    expect(sql).toMatch(/RETURNS TABLE\(pakket text, tarief_type text\)/);
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/);
  });
});
