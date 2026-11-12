// Besluit Boy 12-11-2026 11:39, register D-aanvulling Rechtsvormwijziging 2.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { datumsFout, datumsMelding, laatsteDagOud, machtigingFout, nieuweOndernemingFout, richting, MELDING_EIND_VOOR_INGANG, OVERGANG_TEKST, ERKENNING_TEKST } from "../../supabase/functions/_shared/rechtsvormwijziging";

const NU = "2026-11-12T10:00:00Z";
const ok = { naam: "Jansen BV", kvk: "12345678", rechtsvorm: "BV", straat: "Kerkstraat", huisnummer: "1", postcode: "1234 AB", plaats: "Utrecht", land: "Nederland" };
const lees = (p: string) => readFileSync(p, "utf8");

describe("datums (besluit Boy 12-11 12:11): overlap mag, gat waarschuwt", () => {
  it("ingang = einde + 1 dag mag, zonder melding", () => { expect(datumsFout("2026-11-30", "2026-12-01", NU)).toBeNull(); expect(datumsMelding("2026-11-30", "2026-12-01")).toBeNull(); });
  it("overlap is toegestaan met informatieve melding", () => {
    expect(datumsFout("2026-12-31", "2026-12-01", NU)).toBeNull();
    expect(datumsMelding("2026-12-31", "2026-12-01")).toEqual({ soort: "overlap", tekst: "In deze periode heb je dubbele dekking: je betaalt voor beide ondernemingen." });
  });
  it("gat blokkeert niet maar geeft een waarschuwing", () => {
    expect(datumsFout("2026-11-30", "2026-12-02", NU)).toBeNull();
    expect(datumsMelding("2026-11-30", "2026-12-02")).toEqual({ soort: "gat", tekst: "Let op: tussen deze datums ben je niet verzekerd" });
  });
  it("einddatum oud niet voor de oorspronkelijke ingangsdatum", () => expect(datumsFout("2026-01-01", "2026-12-01", NU, "2026-03-01")).toBe(MELDING_EIND_VOOR_INGANG));
  it("startdatum nieuw verplicht", () => expect(datumsFout("2026-11-30", "", NU)).toMatch(/ingangsdatum/));
  it("ingang vroegst morgen (D4)", () => expect(datumsFout("2026-11-11", "2026-11-12", NU)).toMatch(/vroegst morgen/));
  it("laatste dekkingsdag oud is exact de opgegeven einddatum", () => expect(laatsteDagOud("2027-01-31")).toBe("2027-01-31"));
  it("overgangstekst exact", () => expect(OVERGANG_TEKST).toBe("Je dekking gaat over naar je nieuwe onderneming. Loopt er nog een opdracht via je eenmanszaak (of andersom), dan kan het nodig zijn om een aantal weken of maanden beide verzekeringen naast elkaar te houden. Leidend is je overeenkomst met je opdrachtgever: met welke onderneming heb je die overeenkomst gesloten? Die bepaalt tot wanneer de oude dekking moet lopen en vanaf wanneer de nieuwe begint."));
});

describe("richting en gegevens", () => {
  it("eenmanszaak naar bv en omgekeerd", () => {
    expect(richting("Eenmanszaak", "BV")).toBe("eenmanszaak_naar_bv");
    expect(richting("BV", "Eenmanszaak")).toBe("bv_naar_eenmanszaak");
    expect(nieuweOndernemingFout({ ...ok, rechtsvorm: "Eenmanszaak" }, "87654321")).toBeNull();
  });
  it("nieuw KvK verplicht en anders dan het oude", () => {
    expect(nieuweOndernemingFout({ ...ok, kvk: "123" })).toMatch(/8 cijfers/);
    expect(nieuweOndernemingFout(ok, "12345678")).toMatch(/nieuw KvK-nummer/);
    expect(nieuweOndernemingFout({ ...ok, plaats: "" })).toMatch(/plaats/);
  });
});

describe("machtiging", () => {
  it("zelfde rekening: geen machtiging nodig", () => expect(machtigingFout({ nieuweRekening: false, ibanGeldig: false, rekeninghouder: "", akkoord: false })).toBeNull());
  it("nieuwe rekening: geldig IBAN, rekeninghouder en akkoord verplicht", () => {
    expect(machtigingFout({ nieuweRekening: true, ibanGeldig: false, rekeninghouder: "J", akkoord: true })).toMatch(/IBAN/);
    expect(machtigingFout({ nieuweRekening: true, ibanGeldig: true, rekeninghouder: "Jansen", akkoord: false })).toMatch(/incassomachtiging/);
    expect(machtigingFout({ nieuweRekening: true, ibanGeldig: true, rekeninghouder: "Jansen", akkoord: true })).toBeNull();
  });
  it("server legt de machtiging vast via de bestaande bewijsflow en stuurt geen mail", () => {
    const f = lees("supabase/functions/klant-rechtsvormwijziging/index.ts");
    expect(f).toContain("legBewijsVast(admin, req");
    expect(f).not.toMatch(/resend|verstuurMachtigingBevestiging|createMailGate|verstuurKlantmail/i);
    expect(f).toContain('polis.user_id !== user.id');
  });
});

describe("goedkeuring hergebruikt bestaande omzetting en facturatie", () => {
  const sql = lees("drizzle/migrations/0267_rechtsvormwijziging_zelfservice.sql");
  it("MFA en rol op de server; geen aansluitplicht meer en einddatum exact doorgegeven", () => {
    expect(sql).toContain("'aal2'");
    const nieuw = lees("drizzle/migrations/0271_rechtsvorm_overlap_toegestaan.sql");
    expect(nieuw).not.toContain("NOT IN (0,1)");
    expect(nieuw).toContain("true, true, v_eind)");
    expect(nieuw).toContain("coalesce(_einddatum, _ingangsdatum - 1)");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.rechtsvormwijziging_goedkeuren\(uuid\) FROM PUBLIC, anon/);
  });
  it("gebruikt crm_ondernemingswijziging met polis en contract mee, en koppelt", () => {
    expect(sql).toMatch(/crm_ondernemingswijziging\([^;]*'rechtsvormwijziging'[\s\S]*?true, true\)/);
    expect(sql).toContain("INSERT INTO public.onderneming_koppelingen");
    expect(sql).not.toMatch(/factuur_planning|exact_/);
    expect(lees("src/components/admin/crm/RechtsvormBeoordeling.tsx")).toContain('actie: "omzetten"');
  });
  it("admin toont geen rekeningnummers", () => expect(lees("src/components/admin/crm/RechtsvormBeoordeling.tsx")).not.toMatch(/\biban\b/i));
  it("Mijn ZP toont de erkenning", () => {
    expect(ERKENNING_TEKST).toBe("Wij erkennen je bv als voortzetter van je eenmanszaak. Werk dat je eerder via je eenmanszaak deed, valt zo onder je nieuwe verzekering en er ontstaat geen gat in je dekking.");
    expect(lees("src/pages/portal/PortalRechtsvorm.tsx")).toContain("{ERKENNING_TEKST}");
  });
});
