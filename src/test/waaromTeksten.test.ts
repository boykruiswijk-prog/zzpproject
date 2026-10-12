// @vitest-environment node
import { describe, expect, it } from "vitest";
import { waaromFaqs } from "@/config/waaromFaqs";
import { readFileSync } from "node:fs";

describe("Waarom ZP Zaken tekstcorrecties", () => {
  it("geeft de neutrale toelichting op de premie", () => {
    expect(waaromFaqs.find((f) => f.q === "Hoe houdt ZP Zaken de premie laag?")?.a)
      .toBe("Wij werken met een collectieve polis bij Hiscox voor meer dan 5.000 zzp'ers. Daardoor blijft de premie laag, zonder eigen risico op de BAV + AVB.");
  });
  it("beschrijft de eigen polis zonder vergelijkende prijs- of dekkingsclaim", () => {
    expect(waaromFaqs.find((f) => f.q === "Kan ik naast mijn intermediairverzekering ook bij ZP Zaken verzekerd zijn?")?.a)
      .toBe("Dat hoeft niet: met een eigen polis bij ZP Zaken heb je je BAV en AVB al geregeld, zonder eigen risico en los van je opdrachtgever. Je kunt je intermediair laten weten dat je al verzekerd bent via een eigen polis.");
  });
  it("gebruikt de gecorrigeerde vraag en doorlopende dekking", () => {
    expect(waaromFaqs.some((f) => f.q === "Wat als ik tussen opdrachten zit, ben ik dan verzekerd?")).toBe(true);
    const banner = readFileSync(new URL("../components/waarom/EyeopenerBanner.tsx", import.meta.url), "utf8");
    expect(banner).toContain('value: "Doorlopend", label: "jouw dekking via ZP Zaken, ook tussen opdrachten door"');
    expect(waaromFaqs.map((f) => `${f.q} ${f.a}`).join(" ")).not.toMatch(/zoveel goedkoper|betere dekking voor een lagere prijs|\u2014/);
  });
});