// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { KLANTMAIL_PLACEHOLDERS, VOORBEELD_DATA, vulPlaceholders, prolongatieProduct, schakelaarStaatAan } from "@/lib/klantmailTekst";
import { UITERSTE_DAG, uitersteDatum } from "@/lib/incassoCyclus";
import { prolongatieMails } from "@/lib/prolongatie";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes("klantmails_goedgekeurd"))}`, "utf8");
const teksten = [...sql.matchAll(/E'(Beste \{voornaam\}[^']*(?:''[^']*)*)'/g)].map((m) => m[1].replace(/\\n/g, "\n"));
const onderwerpen = ["Je betaling voor je verzekering is niet gelukt", "Herinnering: je premie staat nog open", "Je dekking is opgeschort", "Je verzekering wordt op {verlengdatum} verlengd", "Je verzekering is beëindigd"];

describe("goedgekeurde klantmails (Boy 15-10-2026)", () => {
  it("vijf teksten zonder BW, artikel, advies of em dash", () => {
    expect(teksten).toHaveLength(5);
    for (const t of [...teksten, ...onderwerpen]) {
      expect(t).not.toMatch(/\bBW\b|artikel|advies|\u2014|7:934/i);
    }
    expect(sql).not.toMatch(/7:934|Burgerlijk/);
  });
  it("alle placeholders vulbaar met voorbeelddata", () => {
    for (const t of [...teksten, ...onderwerpen]) expect(vulPlaceholders(t, VOORBEELD_DATA)).not.toMatch(/\{/);
    for (const k of ["product", "iban", "uiterste_datum", "incasso_datum", "royement_datum", "verlengdatum"]) expect(KLANTMAIL_PLACEHOLDERS).toContain(k);
    expect(() => vulPlaceholders(teksten[0], { ...VOORBEELD_DATA, iban: "" })).toThrow();
    expect(() => vulPlaceholders(teksten[0], { ...VOORBEELD_DATA, polisnummer: null })).toThrow(/polisnummer/);
  });
  it("uiterste datum per stap sluit aan op de cyclus", () => {
    expect(UITERSTE_DAG).toEqual({ herinnering_1: 13, herinnering_2_aanmaning: 27, herinnering_3_opschorting: 41 });
    expect(uitersteDatum("2026-11-01", "herinnering_1")).toBe("2026-11-14");
    expect(uitersteDatum("2026-11-01", "herinnering_2_aanmaning")).toBe("2026-11-28");
    expect(uitersteDatum("2026-11-01", "herinnering_3_opschorting")).toBe("2026-12-12");
    expect(uitersteDatum("2026-11-01", "royement_voorstel")).toBeNull();
    expect(readFileSync("src/lib/incassoCyclus.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/incassoCyclus.ts", "utf8"));
    expect(readFileSync("src/lib/prolongatie.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/prolongatie.ts", "utf8"));
    expect(readFileSync("src/lib/klantmailTekst.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/klantmailTekst.ts", "utf8"));
  });
  it("prolongatie: alleen bav_avb, een per klant, som met cyber", () => {
    const r = prolongatieMails([
      { onderneming_id: "a", product: "bav_avb", verlengdatum: "2026-10-29", netto: 600 },
      { onderneming_id: "a", product: "cyber_clear", verlengdatum: "2026-10-29", netto: 120.5 },
      { onderneming_id: "b", product: "cyber_clear", verlengdatum: "2026-10-29", netto: 120 },
      { onderneming_id: "c", product: "lidmaatschap_light", verlengdatum: "2026-10-29", netto: 50 },
    ]);
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.onderneming_id === "a")).toMatchObject({ mail: true, bedrag: 720.5 });
    expect(r.filter((x) => !x.mail).map((x) => x.onderneming_id).sort()).toEqual(["b", "c"]);
    expect(prolongatieProduct(["bav_avb", "cyber_clear"])).toBe("BAV + AVB en Cyber");
    expect(prolongatieProduct(["bav_avb"])).toBe("BAV + AVB");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS prolongatie_log_klant_verlengdatum ON public.prolongatie_log (onderneming_id, verlengdatum)");
    expect(sql).toContain("public.korting_voor_periode(c.korting_pct, c.korting_vanaf, c.korting_tot, c.volgende_factuurdatum)");
    const fn = readFileSync("supabase/functions/prolongatie-jaarpolis/index.ts", "utf8");
    expect(fn).toContain('onConflict: "onderneming_id,verlengdatum"');
    expect(fn).toContain("prolongatie_mails");
  });
  it("royementsmail alleen na bevestiging, nooit vanuit cron", () => {
    const fn = readFileSync("supabase/functions/royement-bevestiging-mail/index.ts", "utf8");
    expect(fn).toContain("requireSupervisor");
    expect(fn).not.toMatch(/cronOfSupervisor|x-cron-secret/);
    expect(fn).toContain('i.status !== "geroyeerd"');
    expect(fn).toContain("royement_mail_claim");
    expect(fn).toContain('"royement_bevestiging"');
    for (const f of ["incasso-cyclus", "prolongatie-jaarpolis"]) expect(readFileSync(`supabase/functions/${f}/index.ts`, "utf8")).not.toContain("royement_bevestiging");
    const rpc = sql.slice(sql.indexOf("FUNCTION public.bevestig_royement"), sql.indexOf("FUNCTION public.prolongatie_mails"));
    expect(rpc).not.toMatch(/net\.http|enqueue_email|klantmail_log/);
  });
  it("schakelaars aan en goedgekeurd met audit", () => {
    expect(sql).toContain("SET actief = true, status = 'goedgekeurd_boy', goedgekeurd_op = DATE '2026-10-15'");
    expect(sql).toContain("'Boy heeft de tekst goedgekeurd 15-10-2026', 'bron', 'hubchat'");
    expect(sql).toContain("goedgekeurd_op = NULL");
    expect(schakelaarStaatAan({ actief: true, status: "goedgekeurd_boy" })).toBe(true);
  });
});
