// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const loc = { pathname: "/zzp-verzekering-ict", hostname: "zpzaken.nl" };
const gtag = vi.fn();
const opslag = new Map<string, string>();
(globalThis as Record<string, unknown>).window = { location: loc, gtag };
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => opslag.get(k) ?? null,
  setItem: (k: string, v: string) => void opslag.set(k, v),
};

const t = await import("@/lib/tracking");
const { schoonKvk, kvkFoutmelding, isEigenKvk } = await import("@/lib/kvkInvoer");
const { controleerSnelleStart, SNELLE_START_PAKKET } = await import("@/lib/snelleStart");
const lees = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("KvK-veld soepeler", () => {
  it.each(["1234 5678", "1234.5678", "12-345-678", " 12 34 56 78 "])("%s wordt 12345678 en is geldig van formaat", (v) => {
    expect(schoonKvk(v)).toBe("12345678");
    expect(kvkFoutmelding(v)).toBeNull();
  });
  it("na opschonen precies 8 cijfers, anders gewone foutmelding", () => {
    expect(kvkFoutmelding("1234 567")).toMatch(/precies 8 cijfers/);
    expect(kvkFoutmelding("123456789")).toMatch(/precies 8 cijfers/);
    expect(kvkFoutmelding("")).toMatch(/Vul je KVK-nummer in/);
    expect(isEigenKvk("6211 7092")).toBe(true);
  });
  it("invoerveld heeft geen harde maximale lengte van 8", () => {
    expect(lees("components/home/BAVApplicationModule.tsx")).not.toMatch(/id="kvkNummer"[^>]*maxLength=\{8\}/);
  });
});

describe("snelle start", () => {
  it("vraagt e-mail en telefoon en start met het maandpakket", () => {
    expect(SNELLE_START_PAKKET).toBe("maandelijks");
    expect(controleerSnelleStart("jan@voorbeeld.nl", "06 1234 5678")).toEqual({ ok: true, gegevens: { email: "jan@voorbeeld.nl", telefoon: "0612345678" } });
    expect(controleerSnelleStart("geen", "0612345678").ok).toBe(false);
    expect(controleerSnelleStart("jan@voorbeeld.nl", "123").ok).toBe(false);
  });
  it("staat op de beroeps- en BAV-pagina's, niet op de homepage", () => {
    expect(lees("components/diensten/BeroepVerzekeringPagina.tsx")).toContain('aanvraag="snel"');
    expect(lees("pages/ZzpVerzekeringICT.tsx")).toContain('aanvraag="snel"');
    for (const p of ["BavZzp", "Beroepsaansprakelijkheidsverzekering", "ZzpVerzekeringConsultant", "ZzpVerzekeringInterimManager", "ZzpVerzekeringFinance", "ZzpVerzekeringHR", "ZzpVerzekeringMarketing", "ZzpVerzekeringCoach"])
      expect(lees(`pages/${p}.tsx`)).toContain("BeroepVerzekeringPagina");
    expect(lees("pages/Index.tsx")).not.toContain("SnelleStart");
  });
});

describe("conversie aanvraag gestart", () => {
  beforeEach(() => { gtag.mockReset(); opslag.clear(); loc.pathname = "/zzp-verzekering-ict"; });

  it("vuurt één keer per concept, ook na herladen", () => {
    t.trackAanvraagGestart("c1", false);
    t.trackAanvraagGestart("c1", false);
    expect(gtag.mock.calls).toEqual([["event", "aanvraag_gestart", { formulier: "aanvraag", page: "/zzp-verzekering-ict" }]]);
  });
  it("niet bij test of op /tv en /admin", () => {
    t.trackAanvraagGestart("c2", true);
    loc.pathname = "/tv"; t.trackAanvraagGestart("c3", false);
    loc.pathname = "/admin"; t.trackAanvraagGestart("c4", false);
    expect(gtag).not.toHaveBeenCalled();
  });
  it("primaire conversie blijft ongewijzigd", () => {
    expect(t.GOOGLE_ADS_CONVERSIE).toBe("AW-18497139684/rIoQCIid-5IdEOTnj_RE");
  });
});
