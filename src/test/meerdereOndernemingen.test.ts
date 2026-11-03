// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { groepeerPerOnderneming, contractRegelMetHistorie, type MijnOnderneming, type KlantContractPerOnderneming } from "@/lib/klantContractPortaal";
import { tellerUitleg, TELLER_DOEL, groepsTotaal } from "@/lib/menuTellers";

const SQL = readFileSync(join(__dirname, "../../drizzle/migrations/0234_portaltoegang_meerdere_ondernemingen_tellers.sql"), "utf8");
const ond = (id: string, naam: string, historie: boolean, policy_ids: string[]): MijnOnderneming => ({ onderneming_id: id, naam, kvk: null, historie, policy_ids });
const contract = (onderneming_id: string, status: string, eind_datum: string | null = null): KlantContractPerOnderneming =>
  ({ onderneming_id, onderneming_naam: null, product: "BAV", status, begin_datum: "2024-01-01", eind_datum, certificaatnummer: null });

describe("Mijn ZP per onderneming", () => {
  it("groepeert polissen per onderneming, lopend eerst, beëindigd als historie", () => {
    const g = groepeerPerOnderneming(
      [ond("a", "Jansen Eenmanszaak", true, []), ond("b", "Jansen BV", false, ["p1"])],
      [{ id: "p1" }],
      [contract("a", "beeindigd", "2026-09-30"), contract("b", "actief")],
    );
    expect(g.map((x) => x.onderneming?.naam)).toEqual(["Jansen BV", "Jansen Eenmanszaak"]);
    expect(g[0].polissen.map((p) => p.id)).toEqual(["p1"]);
    expect(contractRegelMetHistorie(g[1].contracten[0])).toBe("Beëindigd per 30-09-2026");
  });
  it("toont nooit een polis bij een onderneming waar hij niet bij hoort", () => {
    const g = groepeerPerOnderneming([ond("a", "A", false, ["p1"])], [{ id: "p1" }, { id: "p2" }], []);
    expect(g.find((x) => x.onderneming?.onderneming_id === "a")!.polissen.map((p) => p.id)).toEqual(["p1"]);
    expect(g.find((x) => x.onderneming === null)!.polissen.map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("automatische uitnodiging bij meerdere ondernemingen", () => {
  it("accepteert minstens één actieve onderneming en weigert niet meer bij meerdere", () => {
    expect(SQL).not.toContain("adres hoort bij meerdere klanten");
    expect(SQL).toContain("IF ids IS NULL THEN");
  });
  it("twijfel (zelfde adres bij twee personen) blijft bij het team", () => {
    expect(SQL).toContain("IF n_pers > 1 THEN RETURN jsonb_build_object('match', false");
  });
  it("koppelt polissen van alle ondernemingen van de persoon, nooit van een ander account", () => {
    expect(SQL).toContain("_ids := public.persoon_ondernemingen_ids(_persoon_id);");
    expect(SQL).toContain("WHERE (p.user_id IS NULL OR p.user_id = _portal_user_id)");
    expect(SQL).toContain("IF NOT (o.id = ANY(_ids)) THEN RAISE EXCEPTION");
  });
  it("koppelen en ontkoppelen vereisen 2FA en laten een auditregel achter", () => {
    expect(SQL.match(/coalesce\(auth\.jwt\(\)->>'aal',''\) <> 'aal2'/g)?.length).toBe(2);
    expect(SQL).toContain("'onderneming_gekoppeld'");
    expect(SQL).toContain("'onderneming_ontkoppeld'");
  });
});

describe("menutellers portaltoegang en dubbele klanten", () => {
  it("telt alleen nieuw en in behandeling, zonder testdata", () => {
    expect(SQL).toContain("NOT is_test AND gekoppeld_aan IS NULL AND type = 'portaltoegang' AND coalesce(status,'nieuw') IN ('nieuw','in_behandeling')");
  });
  it("uitleg en doorklik", () => {
    expect(tellerUitleg("portaltoegang", { portaltoegang: 13 })).toBe("13 klanten wachten op toegang tot Mijn ZP");
    expect(tellerUitleg("dubbele_klanten", { dubbele_klanten: 1 })).toBe("1 KvK-nummer staat op meer dan een klantkaart");
    expect(TELLER_DOEL.portaltoegang).toBe("/admin/portaltoegang");
    expect(groepsTotaal(["portaltoegang", "opzeggingen"], { portaltoegang: 13, opzeggingen: 1 })).toBe(14);
  });
});
