import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const mig = readdirSync("drizzle/migrations").filter((f) => f.endsWith("review_crm_notitie.sql")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("");
const bestaand = readFileSync("supabase/functions/review-bestaande-klanten/index.ts", "utf8");
const herinner = readFileSync("supabase/functions/review-verzoeken/index.ts", "utf8");

describe("CRM-notitie bij verstuurd reviewverzoek", () => {
  it("exacte teksten, soort, naam en details", () => {
    expect(mig).toContain("'Reviewverzoek (Google) verstuurd aan bestaande klant, ronde ' || d.ronde || ', namens Ellen Baars.'");
    expect(mig).toContain("'Herinnering reviewverzoek (Google) verstuurd.'");
    expect(mig).toContain("'Systeem (reviewverzoek)'");
    expect(mig).toMatch(/'review_verzoek_id', p_review_verzoek_id, 'ronde', d\.ronde, 'message_id', p_message_id/);
  });
  it("geen dubbele notitie: unieke index per verzoek en mailsoort, ON CONFLICT DO NOTHING", () => {
    expect(mig).toMatch(/CREATE UNIQUE INDEX[\s\S]*details->>'review_verzoek_id'[\s\S]*details->>'mail'/);
    expect(mig).toContain("DO NOTHING");
  });
  it("alleen service_role mag de functie aanroepen", () => {
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.review_crm_notitie[^;]*anon, authenticated/);
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION public\.review_crm_notitie[^;]*TO service_role/);
  });
  it("notitie alleen na geslaagde verzending (ronde en herinnering)", () => {
    expect(bestaand).toMatch(/if \(okSend !== null\) \{[\s\S]*?review_crm_notitie[\s\S]*?p_mail: "verzoek"/);
    expect(herinner).toMatch(/if \(okSend\) await admin\.rpc\("review_crm_notitie", \{[^}]*p_mail: "herinnering"/);
    // testmail maakt nooit een notitie
    expect(bestaand.slice(bestaand.indexOf("if (testNaar)"), bestaand.indexOf("const [{ data: rijen"))).not.toContain("review_crm_notitie");
  });
});
