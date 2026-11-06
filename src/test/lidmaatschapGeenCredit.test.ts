import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { creditZin, soortVanContract } from "../../supabase/functions/_shared/beeindigingTekst";

const sql = readFileSync("drizzle/migrations/0254_lidmaatschap_geen_credit.sql", "utf8");
const REDEN = "Besluit Boy 6-11-2026: lidmaatschappen worden niet gecrediteerd";

describe("D1-aanvulling: geen credit op lidmaatschappen", () => {
  it("planner maakt voor een lidmaatschap direct niet_crediteren, bedrag null, systeem", () => {
    const tak = sql.slice(sql.indexOf("IF k.type = 'lidmaatschap'"), sql.indexOf("-- D1 jaarpolis"));
    expect(tak).toContain("'niet_crediteren'");
    expect(tak).toMatch(/'planner', NULL, public\.lidmaatschap_credit_reden\(\), NULL, 'systeem'/);
    expect(tak).toContain("ON CONFLICT (klant_contract_id, aanvraag_id) DO NOTHING");
    expect(sql).toContain(REDEN);
  });

  it("trigger blokkeert te_maken/goedgekeurd/verwerkt en Exact-statussen met Nederlandse fout", () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF status ON public\.factuur_credit_planning/);
    for (const s of ["te_maken", "goedgekeurd", "geclaimd", "concept_aangemaakt", "verwerkt"]) expect(sql).toContain(`'${s}'`);
    expect(sql).toContain("Een lidmaatschap krijgt nooit een creditnota");
  });

  it("verzekeringen houden de bestaande route met wacht_op_akkoord", () => {
    const rest = sql.slice(sql.indexOf("-- D1 jaarpolis"));
    expect(rest).toContain("v_status := 'wacht_op_akkoord'");
    expect(sql).toContain("IF v_type IS DISTINCT FROM 'lidmaatschap' THEN RETURN NEW; END IF;");
  });

  it("bevestigingsmail belooft geen creditnota bij alleen een lidmaatschap", () => {
    expect(soortVanContract("lidmaatschap", null)).toBe("lidmaatschap");
    expect(soortVanContract(null, "lidmaatschap_allin")).toBe("lidmaatschap");
    expect(soortVanContract("verzekering", "bav_avb")).toBe("verzekering");
    expect(creditZin(["lidmaatschap"])).not.toMatch(/ontvang je daarvoor een creditnota/);
    expect(creditZin(["lidmaatschap", "verzekering"])).toContain("Voor een lidmaatschap ontvang je geen creditnota.");
    expect(creditZin(["verzekering"])).toBe("Is er na die datum al iets gefactureerd, dan ontvang je daarvoor een creditnota.");
  });
});
