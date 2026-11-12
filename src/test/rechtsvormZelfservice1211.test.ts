// Besluit Boy 12-11-2026 11:39, register D-aanvulling Rechtsvormwijziging 2.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { datumsFout, laatsteDagOud, machtigingFout, nieuweOndernemingFout, richting, MELDING_GAT, MELDING_OVERLAP, ERKENNING_TEKST } from "../../supabase/functions/_shared/rechtsvormwijziging";

const NU = "2026-11-12T10:00:00Z";
const ok = { naam: "Jansen BV", kvk: "12345678", rechtsvorm: "BV", straat: "Kerkstraat", huisnummer: "1", postcode: "1234 AB", plaats: "Utrecht", land: "Nederland" };
const lees = (p: string) => readFileSync(p, "utf8");

describe("aansluitende data", () => {
  it("ingang = einde + 1 dag mag", () => expect(datumsFout("2026-11-30", "2026-12-01", NU)).toBeNull());
  it("ingang gelijk aan einde mag", () => expect(datumsFout("2026-12-01", "2026-12-01", NU)).toBeNull());
  it("gat wordt geweigerd", () => expect(datumsFout("2026-11-30", "2026-12-02", NU)).toBe(MELDING_GAT));
  it("overlap wordt geweigerd", () => expect(datumsFout("2026-12-05", "2026-12-01", NU)).toBe(MELDING_OVERLAP));
  it("ingang vroegst morgen (D4)", () => expect(datumsFout("2026-11-11", "2026-11-12", NU)).toMatch(/vroegst morgen/));
  it("laatste dekkingsdag oud is altijd de dag voor de ingang", () => expect(laatsteDagOud("2026-12-01")).toBe("2026-11-30"));
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
  it("MFA, rol en aansluitende data ook op de server", () => {
    expect(sql).toContain("'aal2'");
    expect(sql).toContain("v_ingang - v_eind NOT IN (0,1)");
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
