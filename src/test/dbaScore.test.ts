// @vitest-environment node
// Besluit Boy 12-11-2026: de onderbouwing van de DBA-score moet altijd kloppen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { computeScore, dbaScoreInvoer, dbaScoreControle, type DbaChecklistItem } from "@/lib/dbaScore";
import { leesDbaChecklistUitXml, voegHandmatigSamen } from "../../supabase/functions/_shared/dbaFormulier";

const PEIL = new Date("2026-11-12T12:00:00Z");
const VOL = {
  client_name: "A", opdrachtgever: "B", eindopdrachtgever: "C", functie: "D", project_description: "E",
  project_name: "F", startdatum: "2026-01-01", einddatum: "2026-12-31", optie_verlenging: "Ja",
  uurtarief: "100", uren_per_week: "40", specifieke_vaardigheden: "Ja",
};
const alles = (over: Record<string, string> = {}): DbaChecklistItem[] =>
  ["Overeenkomst Eindopdrachtgever", "Identiteits verklaring", "Curriculum Vitae", "Uittreksel Kamer van Koophandel",
    "Polis beroeps en bedrijfsaansprakelijkheid", "VOG verklaring", "VCA certificering"]
    .map((n) => ({ document_name: n, status: over[n] ?? "aanwezig" }));
const goedePolis = { polis_check_result: { polis_date: "2026-06-01", has_bav: true, has_avb: true } };

describe("computeScore", () => {
  it("alles in orde = 100 zonder punten", () => {
    const r = computeScore(dbaScoreInvoer({ ...VOL, polis_text: "x", suggestions: [goedePolis] }, alles(), PEIL));
    expect(r.score).toBe(100);
    expect(r.aandachtspunten).toEqual([]);
  });

  it("dubbele polisregel: gelezen polis, polisvinkjes tellen niet en dubbele punten tellen één keer", () => {
    const lijst = [...alles({ "Polis beroeps en bedrijfsaansprakelijkheid": "niet_aanwezig" }),
      { document_name: "Polis beroepsaansprakelijkheidsverzekering", status: "niet_aanwezig" }];
    const r = computeScore(dbaScoreInvoer({ ...VOL, polis_text: "x", suggestions: [goedePolis] }, lijst, PEIL));
    expect(r.score).toBe(100);
  });

  it("leeg verplicht veld kost 10", () => {
    const r = computeScore(dbaScoreInvoer({ ...VOL, project_name: " ", polis_text: "x", suggestions: [goedePolis] }, alles(), PEIL));
    expect(r.score).toBe(90);
    expect(r.aandachtspunten).toEqual(["Verplicht veld is leeg: Project"]);
  });

  it("KVK-uittreksel ouder dan 3 maanden kost 10, één keer", () => {
    const c = { ...VOL, kvk_text: "k", kvk_check_result: { kvk_extract_date: "2026-08-11", match: true }, polis_text: "x", suggestions: [goedePolis] };
    expect(computeScore(dbaScoreInvoer(c, alles(), PEIL)).score).toBe(90);
    const jong = { ...c, kvk_check_result: { kvk_extract_date: "2026-08-13", match: true } };
    expect(computeScore(dbaScoreInvoer(jong, alles(), PEIL)).score).toBe(100);
  });

  it("polis zonder BAV kost 10, zonder BAV en AVB ook 10", () => {
    const zonderBav = { polis_check_result: { polis_date: "2026-06-01", has_bav: false, has_avb: true } };
    expect(computeScore(dbaScoreInvoer({ ...VOL, polis_text: "x", suggestions: [zonderBav] }, alles(), PEIL)).score).toBe(90);
    const geen = { polis_check_result: { polis_date: "2026-06-01", has_bav: false, has_avb: false } };
    expect(computeScore(dbaScoreInvoer({ ...VOL, polis_text: "x", suggestions: [geen] }, alles(), PEIL)).score).toBe(90);
  });

  it("polis niet aangeleverd kost 10 en het polisvinkje telt niet nog eens", () => {
    const r = computeScore(dbaScoreInvoer(VOL, alles({ "Polis beroeps en bedrijfsaansprakelijkheid": "niet_aanwezig" }), PEIL));
    expect(r.aandachtspunten).toEqual(["Polis beroeps- en bedrijfsaansprakelijkheid is niet aangeleverd"]);
    expect(r.score).toBe(90);
  });

  it("KVK past niet bij werk is een rode vlag buiten de score", () => {
    const c = { ...VOL, kvk_text: "k", kvk_check_result: { kvk_extract_date: "2026-11-01", match: false }, polis_text: "x", suggestions: [goedePolis] };
    const r = computeScore(dbaScoreInvoer(c, alles(), PEIL));
    expect(r.score).toBe(100);
    expect(r.rode_vlaggen).toHaveLength(1);
  });

  it("ZPDBA1193 (Dura Vermeer) = 60", () => {
    const c = {
      ...VOL, kvk_text: "k", polis_text: "p",
      kvk_check_result: { kvk_extract_date: "2025-09-02", match: true },
      suggestions: [{ score: 90, polis_check_result: { polis_date: "2025-03-13", has_bav: false, has_avb: true } }],
    };
    const lijst = [
      { document_name: "Uittreksel Kamer van Koophandel", status: "aanwezig" },
      { document_name: "Identiteits verklaring", status: "aanwezig" },
      { document_name: "Curriculum Vitae", status: "aanwezig" },
      { document_name: "Polis bedrijfsaansprakelijkheidsverzekering", status: "aanwezig" },
      { document_name: "Polis beroepsaansprakelijkheidsverzekering", status: "niet_aanwezig" },
      { document_name: "VOG verklaring", status: "niet_van_toepassing" },
      { document_name: "VCA certificering", status: "aanwezig" },
      { document_name: "Overeenkomst ondertekend", status: "aanwezig" },
    ];
    const r = computeScore(dbaScoreInvoer(c, lijst, new Date("2026-11-12T00:00:00Z")));
    expect(r.score).toBe(60);
    expect(r.aandachtspunten).toHaveLength(4);
  });
});

describe("certificeren alleen als score en lijst kloppen", () => {
  const vers = { score: 80, aandachtspunten: ["a", "b"], punten: [], rode_vlaggen: [] };
  it("weigert opgeslagen 90 bij 2 punten", () => expect(dbaScoreControle(90, ["a", "b"], vers).ok).toBe(false));
  it("weigert als lijst afwijkt van berekening", () => expect(dbaScoreControle(80, ["a", "c"], vers).ok).toBe(false));
  it("accepteert gelijke score en lijst", () => expect(dbaScoreControle(80, ["b", "a"], vers).ok).toBe(true));
});

describe("checklist uit de vakjes van het formulier", () => {
  const vak = (aan: boolean) => `<w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="${aan ? 1 : 0}"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>${aan ? "☒" : "☐"}</w:t></w:r></w:sdtContent></w:sdt>`;
  const p = (inhoud: string) => `<w:p>${inhoud}</w:p>`;
  const t = (s: string) => `<w:r><w:t>${s}</w:t></w:r>`;
  it("leest 3 kolommen (aanwezig / niet aanwezig / n.v.t.)", () => {
    const xml = p(t("Aanvullende dossier informatie")) + p(t("aanwezig")) + p(t("niet aanwezig")) + p(t("n.v.t."))
      + p(t("VOG verklaring")) + p(vak(false)) + p(vak(false)) + p(vak(true))
      + p(t("Curriculum Vitae")) + p(vak(true)) + p(vak(false)) + p(vak(false));
    expect(leesDbaChecklistUitXml(xml)).toEqual([
      { document_name: "VOG verklaring", status: "niet_van_toepassing", manually_overridden: false },
      { document_name: "Curriculum Vitae", status: "aanwezig", manually_overridden: false },
    ]);
  });
  it("leest 2 kolommen en negeert VCA-subregels", () => {
    const xml = p(t("Aanvullende documentatie")) + p(t("VOG verklaring") + vak(false) + vak(false))
      + p(t("VCA certificering") + vak(true) + vak(false)) + p(vak(true) + t("VCA VOL"));
    expect(leesDbaChecklistUitXml(xml)?.map((x) => x.status)).toEqual(["niet_ingevuld", "aanwezig"]);
  });
  it("handmatige wijziging gaat voor het formulier", () => {
    const uit = voegHandmatigSamen([{ document_name: "VOG verklaring", status: "niet_aanwezig" }],
      [{ document_name: "VOG verklaring", status: "aanwezig", manually_overridden: true }]);
    expect(uit[0].status).toBe("aanwezig");
  });
  it("frontend en server gebruiken byte-gelijke scoreregel", () => {
    expect(readFileSync("src/lib/dbaScore.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/dbaScore.ts", "utf8"));
  });
});
