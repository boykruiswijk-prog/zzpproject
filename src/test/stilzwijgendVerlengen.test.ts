// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { CONTRACT_STATUS_LABEL } from "@/lib/klantContracten";
import { contractEindStatus } from "@/lib/bavNummer";

const migDir = "drizzle/migrations";
const mig = readFileSync(`${migDir}/${readdirSync(migDir).find((f) => f.includes("stilzwijgend_verlengen"))}`, "utf8");

describe("D1-aanvulling: stilzwijgend verlengen", () => {
  it("(a) einddatum zonder opzegging blokkeert niet: oude regel en einddatum_controle-blokkade worden verwijderd", () => {
    expect(mig).toContain("THEN ''na einddatum contract''");
    expect(mig).toContain("WHEN p.status = ''einddatum_controle'' THEN ''einddatum controleren door Ellen''");
    expect(mig).toMatch(/replace\(d, 'WHEN p\.status = ''einddatum_controle'' THEN ''einddatum''', ''\)/);
    expect(mig).toContain("IF position('na einddatum' IN d) > 0");
    // periodes worden vergeleken met de opzegdatum, niet met eind_datum; prijslogica blijft onaangeraakt
    expect(mig).toContain("p.ps > p.opz");
    expect(mig).not.toMatch(/contract_bedrag_voor_periode|korting_netto/);
  });
  it("(b) echte opzegging (o.a. handmatig_beeindigd) geeft soort opgezegd met label 'Opgezegd per'", () => {
    expect(mig).toMatch(/'handmatig_beeindigd','opzegging_verwerken','opzegging_verwerkt','einddatum_opzegging_bevestigd'/);
    expect(mig).toContain("l.status IN ('opgezegd','gepauzeerd')");
    expect(mig).toContain("THEN ''Opgezegd per '' || to_char(p.opz, ''DD-MM-YYYY'')");
    expect(mig).toContain("THEN ''opgezegd''");
  });
  it("(c) geen 'na einddatum' of 'einddatum controleren' meer in beheerschermen", () => {
    for (const f of ["src/pages/admin/Facturatieplanning.tsx", "src/components/admin/VandaagTeDoen.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/na einddatum contract|einddatum controleren|einddatum_controle/i);
    }
    expect(CONTRACT_STATUS_LABEL.einddatum_controle).toBe("Actief");
  });
  it("(d) ochtendmail exact-concept-controle meldt geen einddatum zonder opzegging", () => {
    const s = readFileSync("supabase/functions/exact-concept-controle/index.ts", "utf8");
    expect(s).not.toContain("einddatum_zonder_opzegging");
    expect(s).not.toMatch(/einddatumZonder|Einddatum zonder/);
  });
  it("(e) einddatum alleen geeft op klantkaart geen beeindigd/loopt af", () => {
    expect(contractEindStatus({ status: "actief", eind_datum: "2020-01-01" }).soort).toBe("lopend");
    expect(contractEindStatus({ status: "loopt_af", eind_datum: "2099-01-01" }).soort).toBe("loopt_af");
    for (const f of ["src/components/admin/crm/KlantKaart.tsx", "src/components/admin/crm/LopendeProducten.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toContain("Loopt af per");
    }
  });
});
