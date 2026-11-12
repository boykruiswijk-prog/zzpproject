// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { WIZARD_SECTOREN } from "@/data/sectorVerzekeringskaart";
import { MAATWERK_TEKST, heeftMaatwerkVlag, maatwerkMailZin, maatwerkVlag, moetMaatwerkTonen } from "@/lib/maatwerk";
import { renderCustomerHtml, renderCustomerText } from "../../supabase/functions/send-lead-notification/index";

describe("maatwerk-melding (besluit Boy 12-11-2026 12:03)", () => {
  it("popup bij zorg en bouw & techniek, niet bij andere sectoren", () => {
    expect(moetMaatwerkTonen("", "zorg")).toBe(true);
    expect(moetMaatwerkTonen("", "bouw")).toBe(true);
    for (const s of WIZARD_SECTOREN.filter((x) => !["zorg", "bouw"].includes(x.id))) expect(moetMaatwerkTonen("", s.id)).toBe(false);
  });
  it("niet opnieuw binnen maatwerk, wel opnieuw na uit en weer aan", () => {
    expect(moetMaatwerkTonen("zorg", "bouw")).toBe(false);
    expect(moetMaatwerkTonen("zorg", "zorg")).toBe(false);
    expect(moetMaatwerkTonen("ict", "zorg")).toBe(true);
  });
  it("aanvraag blijft verzendbaar: popup blokkeert de validatie niet", () => {
    const src = readFileSync("src/components/home/BAVApplicationModule.tsx", "utf8");
    expect(src).not.toMatch(/newErrors\.[a-z]+ = [^;]*[Mm]aatwerk/);
    expect(src).toContain("moetMaatwerkTonen(formData.sector, v)");
    expect(readFileSync("src/pages/OffertePage.tsx", "utf8")).toContain("moetMaatwerkTonen(form.branche, v)");
  });
  it("vlag met sector(en) wordt door de server meegestuurd", () => {
    expect(maatwerkVlag("Zorg")).toEqual({ maatwerk_check: true, maatwerk_sectoren: ["Zorg"] });
    expect(maatwerkVlag("bouw", "Bouw & techniek")).toEqual({ maatwerk_check: true, maatwerk_sectoren: ["Bouw & techniek"] });
    expect(maatwerkVlag("ICT")).toBeNull();
    expect(readFileSync("supabase/functions/process-bav-wizard/index.ts", "utf8")).toContain("...(maatwerkVlag(submission.sector) ?? {})");
    const spf = readFileSync("supabase/functions/submit-public-form/index.ts", "utf8");
    expect(spf).toContain("delete extraUit.maatwerk_check");
    expect(spf).toContain("maatwerkVlag(extraUit.sector, extraUit.branche)");
  });
  it("label alleen bij vlag", () => {
    expect(heeftMaatwerkVlag({ maatwerk_check: true, maatwerk_sectoren: ["Zorg"] })).toBe(true);
    expect(heeftMaatwerkVlag({ sector: "Zorg" })).toBe(false);
    expect(heeftMaatwerkVlag(null)).toBe(false);
  });
  it("mailzin alleen bij vlag", () => {
    const zin = maatwerkMailZin({ maatwerk_check: true, maatwerk_sectoren: ["Zorg"] });
    expect(zin).toBe("Omdat je actief bent in de zorg nemen wij binnenkort contact met je op over je dekking.");
    expect(maatwerkMailZin({ maatwerk_check: true, maatwerk_sectoren: ["Bouw & techniek"] })).toBe("Omdat je actief bent in de bouw of techniek nemen wij binnenkort contact met je op over je dekking.");
    expect(maatwerkMailZin({ sector: "Zorg" })).toBeNull();
    expect(renderCustomerHtml("bav", "BAV", {}, false, "", zin)).toContain(zin!);
    expect(renderCustomerText("bav", {}, false, "", zin)).toContain(zin!);
    expect(renderCustomerText("bav", {}, false, "", null)).not.toContain("Omdat je actief bent");
  });
  it("teksten zonder verboden woorden of em-streepjes", () => {
    const alles = MAATWERK_TEKST + readFileSync("src/lib/maatwerk.ts", "utf8") + (maatwerkMailZin({ maatwerk_check: true, maatwerk_sectoren: ["Zorg", "Bouw & techniek"] }) ?? "");
    expect(alles).not.toMatch(/advies|adviseur|tussenpersoon|\u2014/i);
  });
});
