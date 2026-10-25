// @vitest-environment node
// E-aanvulling 6 (besluit Boy): alleen Ellen mag in de admin terugwerkend cyber laten ingaan.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { cyberTerugwerkendVroegst, cyberVerzoekFout } from "@/lib/cyberToevoegen";

const OK = { a: false, b: true, c: true, d: true, e: false, f: false };
const nu = new Date("2026-10-25T12:00:00Z");
const notitie = "Klant wilde cyber al bij aanvraag";
const ellen = { email: "ellen.baars@zpzaken.nl", team: true, cyberInAanvraag: true, bavIngang: "2026-10-23" };

describe("terugwerkende cyberingangsdatum", () => {
  it("Ellen mag 23-10 bij klant met cyber in de oorspronkelijke aanvraag", () => {
    const v = cyberTerugwerkendVroegst(ellen);
    expect(v).toBe("2026-10-23");
    expect(cyberVerzoekFout(OK, "2026-10-23", true, true, notitie, nu, v)).toBeNull();
  });
  it("Ellen mag het niet bij een klant zonder cyber in de aanvraag", () => {
    const v = cyberTerugwerkendVroegst({ ...ellen, cyberInAanvraag: false });
    expect(v).toBeNull();
    expect(cyberVerzoekFout(OK, "2026-10-23", true, true, notitie, nu, v)).not.toBeNull();
  });
  it("Ellen niet vóór de BAV-ingangsdatum", () => {
    expect(cyberVerzoekFout(OK, "2026-10-22", true, true, notitie, nu, "2026-10-23")).toMatch(/23-10-2026/);
  });
  it("ander teamlid en klant krijgen weigering", () => {
    expect(cyberTerugwerkendVroegst({ ...ellen, email: "boy.kruiswijk@zpzaken.nl" })).toBeNull();
    expect(cyberTerugwerkendVroegst({ ...ellen, team: false })).toBeNull();
    expect(cyberVerzoekFout(OK, "2026-10-23", true, false, "", nu, "2026-10-23")).not.toBeNull();
  });
  it("server dwingt hetzelfde af en logt wie en waarom", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.includes("cyber_terugwerkend_alleen_ellen"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toMatch(/='ellen\.baars@zpzaken\.nl'/);
    expect(sql).toMatch(/l\.extra_data \? 'cyber'/);
    expect(sql).toMatch(/v_terug:=CASE WHEN _namens_klant THEN public\.cyber_terugwerkend_vroegst/);
    expect(sql).toMatch(/_ingang < v_terug THEN RAISE EXCEPTION/);
    expect(sql).toMatch(/'cyber_ingang_terugwerkend'/);
  });
});
