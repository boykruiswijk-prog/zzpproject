import { describe, it, expect } from "vitest";
import { schoonBingAi, bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { readFileSync } from "node:fs";

describe("Copilot-citaties op het scherm", () => {
  it("toont laatste meting met periode en neutrale categorieen", () => {
    const b = schoonBingAi([{ datum: "2026-11-02", periode: "3M", citaties: 573, onderwerpen: ["kosten", "beste keuze", "algemeen"] }]);
    expect(b).toEqual({ datum: "2026-11-02", citaties: 573, periode: "laatste 3 maanden", trend: null, onderwerpen: ["kosten", "beste keuze", "algemeen"] });
  });
  it("trend omhoog en omlaag ten opzichte van vorige meting", () => {
    expect(schoonBingAi([{ datum: "2026-11-02", periode: "3M", citaties: 500 }, { datum: "2026-11-09", periode: "3M", citaties: 573 }])?.trend).toBe("omhoog");
    expect(schoonBingAi([{ datum: "2026-11-02", periode: "3M", citaties: 600 }, { datum: "2026-11-09", periode: "3M", citaties: 573 }])?.trend).toBe("omlaag");
  });
  it("zoekvragen of namen komen nooit op het scherm", () => {
    const b = schoonBingAi([{ datum: "2026-11-02", periode: "3M", citaties: 1, onderwerpen: ["wat kost een bav bij jan jansen", "kosten"] }]);
    expect(b?.onderwerpen).toEqual(["kosten"]);
  });
  it("zonder meting geen tegel, bestaande AI-cijfers blijven", () => {
    const p = bouwSchermPayload({ marketing: { ai_zichtbaarheid: { dag: "2026-11-02", data: { score: 40 } } } });
    expect(p.bing_ai).toBeNull();
    expect(p.marketing.ai_zichtbaarheid?.score).toBe(40);
  });
  it("functie valideert invoer en is alleen voor agents (service_role)", () => {
    const sql = readFileSync("drizzle/migrations/0223_bing_ai_metingen.sql", "utf8");
    expect(sql).toMatch(/maximaal 10 onderwerpen/);
    expect(sql).toMatch(/length\(v_o\) > 200/);
    expect(sql).toMatch(/p_citaties < 0/);
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
  });
});
