import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isEigenKvk, KVK_PLACEHOLDER, OUD_VOORBEELD_KVK } from "@/lib/kvkInvoer";
import { bouwNabelMail, herkomstTekst, moetNabellen, schoneVeldnamen, NABEL_ONDERWERP, type NabelConcept } from "../../supabase/functions/_shared/nabellen";
import { ibanVertrouwenTekst } from "@/components/home/IbanVertrouwen";

const bron = readFileSync("src/components/home/BAVApplicationModule.tsx", "utf8");
const server = readFileSync("supabase/functions/process-bav-wizard/index.ts", "utf8");
const nabelFn = readFileSync("supabase/functions/aanvraag-nabellen/index.ts", "utf8");

describe("KVK-invoer", () => {
  it("weigert placeholder, gelijke cijfers en fout formaat; geen 11-proef", () => {
    expect(isEigenKvk(OUD_VOORBEELD_KVK)).toBe(false);
    for (const d of "0123456789") expect(isEigenKvk(d.repeat(8))).toBe(false);
    expect(isEigenKvk("1234567")).toBe(false);
    expect(isEigenKvk("62117092")).toBe(true);
    expect(isEigenKvk("12345679")).toBe(true);
  });
  it("placeholder zonder cijfers en server controleert ook", () => {
    expect(/\d/.test(KVK_PLACEHOLDER.replace("8 cijfers", ""))).toBe(false);
    expect(bron).not.toContain('placeholder="12345678"');
    expect(server).toContain("isEigenKvk(");
  });
});

describe("stap 2 korter, adres in stap 4", () => {
  const stap2 = bron.slice(bron.indexOf("if (step === 2)"), bron.indexOf("if (step === 3)"));
  const stap4 = bron.slice(bron.indexOf("if (step === 4)"), bron.indexOf("if (step === 5)"));
  it("validatie verhuisd", () => {
    expect(stap2).not.toMatch(/adresStraat|adresPostcode|adresPlaats|adresHuisnummer/);
    for (const v of ["adresStraat", "adresHuisnummer", "adresPostcode", "adresPlaats"]) expect(stap4).toContain(v);
    expect(stap4).toContain("Postcode moet formaat 1234 AB hebben");
  });
  it("adresvelden staan in stap 4 boven het IBAN, starter in uitklapblok", () => {
    const s4 = bron.slice(bron.indexOf("{currentStep === 4 &&"), bron.indexOf("{currentStep === 5 &&"));
    expect(s4.indexOf('id="adresStraat"')).toBeGreaterThan(-1);
    expect(s4.indexOf('id="adresStraat"')).toBeLessThan(s4.indexOf('id="iban"'));
    expect(s4.indexOf("<IbanVertrouwen")).toBeLessThan(s4.indexOf('id="iban"'));
    const s2 = bron.slice(bron.indexOf("{currentStep === 2 &&"), bron.indexOf("{currentStep === 3 &&"));
    expect(s2).not.toContain('id="adresStraat"');
    expect(s2).toContain("Ben je korter dan 12 maanden ingeschreven bij de KVK? Dan geldt het startertarief");
    expect(s2.indexOf("<details")).toBeLessThan(s2.indexOf("<KvkUittrekselVeld"));
    expect(stap2).toContain("UITTREKSEL_VERPLICHT");
  });
  it("payload naar de server blijft dezelfde velden sturen", () => {
    for (const k of ["kvk_nummer:", "kvk_startdatum:", "adres_straat:", "adres_huisnummer:", "adres_postcode:", "adres_plaats:", "adres_land:", "iban:", "rekeninghouder:", "kvk_uittreksel_id:", "concept_id:", "sepa_akkoord:"])
      expect(bron).toContain(k);
  });
});

describe("IBAN-vertrouwen", () => {
  it("feitelijke tekst zonder verboden woorden", () => {
    for (const p of ["maand", "jaar"] as const) {
      const t = ibanVertrouwenTekst(p);
      expect(t).toMatch(/vanaf de ingangsdatum/);
      expect(t.toLowerCase()).not.toMatch(/advies|adviseur|afsluiten|direct gedekt/);
    }
    expect(ibanVertrouwenTekst("jaar")).toContain("per jaar");
  });
});

describe("nabellen", () => {
  const nu = new Date("2026-10-14T12:00:00Z");
  const basis: NabelConcept = { id: "c1", status: "open", is_test: false, lead_id: null, dubbel_lead_id: null, telefoon: "0612345678", email: null,
    laatst_actief_op: "2026-10-14T11:00:00Z", team_gemeld_op: null, voornaam: "Jan", achternaam: "Jansen", bedrijfsnaam: "Jansen BV",
    pakket: "maandelijks", stap: 2, max_stap: 4, attributie: { utm_source: "google", kanaal: "betaald" } };
  it("filtert volgens de regels", () => {
    expect(moetNabellen(basis, nu)).toBe(true);
    expect(moetNabellen({ ...basis, laatst_actief_op: "2026-10-14T11:45:00Z" }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, is_test: true }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, lead_id: "x" }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, dubbel_lead_id: "x" }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, team_gemeld_op: "2026-10-14T11:50:00Z" }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, status: "omgezet" }, nu)).toBe(false);
    expect(moetNabellen({ ...basis, telefoon: null, email: null }, nu)).toBe(false);
  });
  it("mail bevat alle gevraagde gegevens", () => {
    const m = bouwNabelMail(basis);
    expect(m.subject).toBe(NABEL_ONDERWERP);
    for (const v of ["Jan Jansen", "Jansen BV", "0612345678", "maandelijks", "4 van 5", "bron google", "kanaal betaald", "/admin/afgehaakt"]) expect(m.text).toContain(v);
    expect(herkomstTekst(null)).toBe("Onbekend");
  });
  it("functie mailt alleen intern, met claim en cron-secret", () => {
    expect(nabelFn).toContain("verstuurInterneMelding");
    expect(nabelFn).toContain("verify_cron_secret");
    expect(nabelFn).toContain('.is("team_gemeld_op", null)');
    expect(nabelFn).not.toMatch(/to:\s*c\.email/);
  });
  it("validatielog bewaart alleen veldnamen", () => {
    expect(schoneVeldnamen(["iban", "adresPostcode", "jan@x.nl", "1234 AB", 5])).toEqual(["iban", "adresPostcode"]);
  });
});
