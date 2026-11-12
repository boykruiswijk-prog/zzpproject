// Besluit Boy 12-11-2026, register D-aanvulling Rechtsvormwijziging.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { koppelRedenFout, vorigeOndernemingFouten, vorigeOndernemingUitFormulier, vorigeOndernemingVelden, VORIGE_VRAAG } from "@/lib/vorigeOnderneming";

const lees = (p: string) => readFileSync(p, "utf8");

describe("aanvraagveld vorige onderneming", () => {
  it("is optioneel: niet aangevinkt geeft geen fouten en geen velden", () => {
    expect(vorigeOndernemingFouten({ aan: false, naam: "", kvk: "" })).toEqual({});
    expect(vorigeOndernemingVelden({ aan: false, naam: "X", kvk: "12345678" })).toEqual([]);
  });
  it("aangevinkt vraagt naam en KvK van 8 cijfers", () => {
    expect(vorigeOndernemingFouten({ aan: true, naam: "", kvk: "123" })).toHaveProperty("naam");
    expect(vorigeOndernemingFouten({ aan: true, naam: "Jansen Advies", kvk: "123" })).toHaveProperty("kvk");
    expect(vorigeOndernemingFouten({ aan: true, naam: "Jansen", kvk: "1234 5678" })).toEqual({});
  });
  it("komt in de aanvraag en is voor het team terug te lezen", () => {
    const velden = vorigeOndernemingVelden({ aan: true, naam: " Jansen ", kvk: "1234 5678" }).map(([label, waarde]) => ({ label, waarde }));
    expect(velden[0]).toEqual({ label: VORIGE_VRAAG, waarde: "Ja" });
    expect(vorigeOndernemingUitFormulier(velden)).toEqual({ naam: "Jansen", kvk: "12345678" });
    expect(vorigeOndernemingUitFormulier([{ label: "Bedrijfsnaam", waarde: "X" }])).toBeNull();
  });
  it("staat in het formulier en in de verzonden formulierinhoud", () => {
    const f = lees("src/components/home/BAVApplicationModule.tsx");
    expect(f).toContain("vorigeOndernemingVelden({ aan: vorigeAan");
    expect(f).toContain("{VORIGE_VRAAG} (optioneel)");
  });
  it("nieuwe machtiging blijft verplicht onderdeel van elke aanvraag", () => {
    expect(lees("src/components/home/BAVApplicationModule.tsx")).toMatch(/if \(!incassoAkkoord\) newErrors\.incassoAkkoord/);
  });
});

describe("koppelen aan vorige onderneming", () => {
  it("reden is verplicht, 10 tot 500 tekens", () => {
    expect(koppelRedenFout("kort")).not.toBeNull();
    expect(koppelRedenFout("x".repeat(501))).not.toBeNull();
    expect(koppelRedenFout("Rechtsvormwijziging eenmanszaak naar bv")).toBeNull();
  });
  it("server: MFA, teamrol, reden, audit, notitie op beide, geen anon", () => {
    const sql = lees("drizzle/migrations/0266_onderneming_koppelingen.sql");
    expect(sql).toContain("'aal2'");
    expect(sql).toContain("mag_crm_beeindigen(auth.uid())");
    expect(sql).toContain("length(r) < 10 OR length(r) > 500");
    expect(sql).toContain("sensitive_audit_log");
    expect(sql.match(/crm_notitie_toevoegen/g)?.length).toBe(2);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.onderneming_koppel_vorige\(uuid, uuid, text, uuid\) FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/UPDATE public\.(policies|klant_contracten)/);
  });
  it("koppeling toont geen rekeningnummers", () => {
    expect(lees("src/components/admin/crm/VorigeOnderneming.tsx").toLowerCase()).not.toMatch(/iban|rekeningnummer/);
  });
  it("omzetten is niet meer de standaardroute", () => {
    expect(lees("src/components/admin/crm/Opvolging.tsx")).toContain("useState(false);\n  const meenemen");
  });
});
