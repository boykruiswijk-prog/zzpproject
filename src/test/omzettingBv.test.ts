// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { omzettenInvoerFout, aanvraagAfgerond, handmatigAfrondenFout } from "@/lib/omzetting";
import { filterAanvragenOpTab } from "@/lib/leadVlag";

const SQL = readFileSync(join(__dirname, "../../drizzle/migrations/0236_omzetting_bv_en_aanvraag_afronden.sql"), "utf8");
const GEN = readFileSync(join(__dirname, "../../supabase/functions/generate-certificate/index.ts"), "utf8");

describe("Omzetten naar BV", () => {
  it("vraagt onderneming, datum en toelichting van minstens 10 tekens", () => {
    expect(omzettenInvoerFout({ naarId: null, datum: "2026-11-29", reden: "Eenmanszaak -> BV" })).toBe("Kies de nieuwe onderneming.");
    expect(omzettenInvoerFout({ naarId: "x", datum: "", reden: "Eenmanszaak -> BV" })).toBe("Kies de ingangsdatum van de BV.");
    expect(omzettenInvoerFout({ naarId: "x", datum: "2026-11-29", reden: "kort" })).toBe("Toelichting is verplicht (minimaal 10 tekens).");
    expect(omzettenInvoerFout({ naarId: "x", datum: "2026-11-29", reden: "Eenmanszaak -> BV" })).toBeNull();
  });
  it("verplaatst dezelfde polis als nieuwe versie, maakt geen tweede polis en bewaart de oude versie", () => {
    expect(SQL).toContain("'omgezet'");
    expect(SQL).toContain("UPDATE public.policies SET onderneming_id = nn.id, lead_id = _lead_id, certificate_holder = nn.naam");
    expect(SQL).not.toMatch(/INSERT INTO public\.policies\b/);
    expect(SQL).toContain("'polis_omgezet'");
  });
  it("koppelt de personen van de eenmanszaak aan de BV en wijzigt geen contracten", () => {
    expect(SQL).toContain("INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)\n    SELECT po.persoon_id, nn.id");
    expect(SQL).not.toMatch(/UPDATE public\.klant_contracten/);
  });
  it("certificaatfout over een bezet nummer verwijst naar Omzetten naar BV in plaats van 'Failed to create policy'", () => {
    expect(GEN).toContain('code: "nummer_al_geldig"');
    expect(GEN).toContain('"23505"');
  });
  it("omzetten verstuurt nooit mail", () => {
    const blok = GEN.slice(GEN.indexOf('actie === "omzetten"'), GEN.indexOf('actie === "nummer_overnemen"'));
    expect(blok).not.toMatch(/mailCertificaat|sendPortalMail|autoInvite/);
  });
});

describe("herkenning bestaande klant", () => {
  it("zelfde bedrijfsnaam zonder rechtsvorm is een signaal", () => {
    expect(SQL).toContain("zelfde bedrijfsnaam (");
    expect(SQL).toContain("bedrijfsnaam_kern");
  });
});

describe("aanvraag rondt pas af na certificaat verstuurd", () => {
  it("actieve polis zonder verstuurd certificaat blijft in Te doen", () => {
    const r = filterAanvragenOpTab([
      { id: "a", status: "actief", vlag: null, aanvraag_afgerond_op: null },
      { id: "b", status: "actief", vlag: null, aanvraag_afgerond_op: "2026-11-03T10:00:00Z" },
    ], "te_doen", "2026-11-03");
    expect(r.map((x) => x.id)).toEqual(["a"]);
    expect(aanvraagAfgerond({ aanvraag_afgerond_op: null })).toBe(false);
  });
  it("handmatig afronden vraagt een reden van minstens 10 tekens", () => {
    expect(handmatigAfrondenFout("te kort")).toBe("Geef een reden (minimaal 10 tekens).");
    expect(handmatigAfrondenFout("klant heeft certificaat zelf al")).toBeNull();
    expect(SQL).toContain("IF length(btrim(coalesce(_reden,''))) < 10 THEN RAISE EXCEPTION 'geef een reden (minimaal 10 tekens)'");
  });
  it("certificaatmail rondt automatisch af", () => {
    expect(SQL).toContain("aanvraag_afgerond_reden = 'certificaat verstuurd'");
    expect(SQL).toContain("CREATE TRIGGER trg_aanvraag_afronden_versie AFTER INSERT ON public.policy_versies");
  });
});
