// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { certificaatMailLabel, factuurLabel, ingangsdatumBlokkade } from "@/lib/ingangsdatumWijzigen";

const v = "2026-11-12";
const c = { begin_datum: "2026-12-01", eind_datum: null, gefactureerd_tm: "2026-11-30" };
const reden = "Klant wil eerder starten";

describe("ingangsdatum wijzigen: blokkeerregels (besluit Boy 12-11-2026)", () => {
  it("Barts: 01-12 naar 30-11 mag", () => expect(ingangsdatumBlokkade(c, v, "2026-11-30", reden)).toBeNull());
  it("factuur_planning-regel blokkeert", () => expect(ingangsdatumBlokkade({ ...c, planning_regels: 1 }, v, "2026-11-30", reden)).toMatch(/factuur gepland/));
  it("credit-planningregel blokkeert", () => expect(ingangsdatumBlokkade({ ...c, credit_regels: 1 }, v, "2026-11-30", reden)).toMatch(/creditnota/));
  it("gefactureerd_tm >= begin_datum blokkeert", () => expect(ingangsdatumBlokkade({ ...c, gefactureerd_tm: "2026-12-01" }, v, "2026-11-30", reden)).toMatch(/al gefactureerd/));
  it("beëindigd contract blokkeert", () => expect(ingangsdatumBlokkade({ ...c, eind_datum: "2027-01-01" }, v, "2026-11-30", reden)).toMatch(/beëindigd/));
  it("gelijke datum blokkeert", () => expect(ingangsdatumBlokkade(c, v, "2026-12-01", reden)).toMatch(/gelijk/));
  it("meer dan 1 jaar vooruit blokkeert, precies 1 jaar mag", () => {
    expect(ingangsdatumBlokkade(c, v, "2027-11-13", reden)).toMatch(/1 jaar/);
    expect(ingangsdatumBlokkade(c, v, "2027-11-12", reden)).toBeNull();
  });
  it("meer dan 60 dagen terug blokkeert, precies 60 mag", () => {
    expect(ingangsdatumBlokkade(c, v, "2026-09-12", reden)).toMatch(/60 dagen/);
    expect(ingangsdatumBlokkade(c, v, "2026-09-13", reden)).toBeNull();
  });
  it("reden korter dan 10 tekens blokkeert", () => {
    expect(ingangsdatumBlokkade(c, v, "2026-11-30", "  te kort ")).toMatch(/10 tekens/);
    expect(ingangsdatumBlokkade(c, v, "2026-11-30", "1234567890")).toBeNull();
  });
  it("database gebruikt dezelfde regels en raakt Exact niet", () => {
    const sql = readFileSync("drizzle/migrations/0268_contract_wijzig_ingangsdatum.sql", "utf8");
    for (const s of ["status NOT IN ('geannuleerd','fout')", "factuur_credit_planning", "gefactureerd_tm >= c.begin_datum", "interval '1 year'", "vandaag - 60", "< 10", "'aal2'", "mag_crm_beeindigen", "'ingangsdatum_gewijzigd'"]) expect(sql).toContain(s);
    expect(sql.toLowerCase()).not.toContain("exact_account_id =");
  });
});

describe("labels", () => {
  it("nog niet gefactureerd zolang gefactureerd_tm < begin_datum zonder factuur", () => {
    expect(factuurLabel(c, false)).toBe("Nog niet gefactureerd (start 01-12-2026)");
    expect(factuurLabel({ begin_datum: "2026-12-01", gefactureerd_tm: null }, false)).toBe("Nog niet gefactureerd (start 01-12-2026)");
  });
  it("gefactureerd t/m zodra er gefactureerd is of een factuur bestaat", () => {
    expect(factuurLabel({ begin_datum: "2026-01-01", gefactureerd_tm: "2026-11-30" }, false)).toBe("Gefactureerd t/m 30-11-2026");
    expect(factuurLabel(c, true)).toBe("Gefactureerd t/m 30-11-2026");
  });
  it("certificaatmail", () => {
    expect(certificaatMailLabel(null)).toBe("Certificaat nog niet gemaild");
    expect(certificaatMailLabel("2026-11-11T16:37:13Z")).toBe("Certificaat gemaild op 11-11-2026 17:37");
  });
});
