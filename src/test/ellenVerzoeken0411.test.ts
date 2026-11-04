import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normaliseerTelefoon, isGeldigTelefoon } from "../../supabase/functions/_shared/telefoon";
import { klantPlaats } from "@/lib/klantPlaats";
import { openContractMeenemen } from "@/lib/omzetting";
import { vraagtHandeling, wordtAutomatischAfgerond, afrondMoment, WACHTTIJD_DAGEN } from "@/lib/afhakers";

const sql = readFileSync("drizzle/migrations/0240_gegevens_aanvullen_contract_mee_afhakers.sql", "utf8");
const fn = (naam: string) => { const i = sql.indexOf(`FUNCTION public.${naam}(`); return sql.slice(i, sql.indexOf("$function$;", i)); };

describe("1. Telefoonnummer en plaats", () => {
  it("accepteert NL en internationaal, weigert de rest", () => {
    expect(normaliseerTelefoon("06 1234 5678")).toBe("0612345678");
    expect(normaliseerTelefoon("+31 6 12345678")).toBe("0612345678");
    expect(normaliseerTelefoon("0032 470 12 34 56")).toBe("+32470123456");
    expect(isGeldigTelefoon("12345")).toBe(false);
    expect(isGeldigTelefoon("0612")).toBe(false);
  });
  it("SQL hanteert dezelfde telefoonregel", () => {
    expect(sql).toContain("'^(\\+31|0031|0)[1-9][0-9]{8}$'");
    expect(sql).toContain("'^(\\+|00)[1-9][0-9]{7,14}$'");
  });
  it("klant past alleen eigen gegevens aan, alleen lege velden, met tijdlijn", () => {
    const f = fn("mijn_gegevens_aanvullen");
    expect(f).toContain("public.mijn_persoon_ids()");
    expect(f).toContain("persoon_id = ANY(v_pers)");
    expect(f).toContain("RAISE EXCEPTION 'geen toegang tot deze onderneming'");
    expect(f).toContain("coalesce(btrim(o.plaats),'') = ''");
    expect(f).toContain("INSERT INTO crm_notities");
    expect(fn("mijn_persoon_ids")).toContain("u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.mijn_gegevens_aanvullen(text, jsonb) FROM PUBLIC, anon;");
  });
  it("later verbergt de kaart 7 dagen", () => {
    expect(fn("mijn_gegevens_later")).toContain("now() + interval '7 days'");
  });
  it("plaats uit adres, anders plaats onbekend", () => {
    expect(klantPlaats({ plaats: "Edam" })).toBe("Edam");
    expect(klantPlaats({ plaats: "", kvk_plaats: "Volendam" })).toBe("Volendam");
    expect(klantPlaats({}, [null, "Purmerend"])).toBe("Purmerend");
    expect(klantPlaats({})).toBe("plaats onbekend");
  });
});

describe("2. Rechtsvormwijziging zonder eigen contract", () => {
  const opv = [{ id: "o1", van_onderneming_id: "ez", naar_onderneming_id: "bv", soort: "rechtsvormwijziging", ingangsdatum: "2026-10-26" }];
  it("contract van voorganger (beeindigd dag voor ingang) kan mee", () => {
    const r = openContractMeenemen("bv", opv, [{ onderneming_id: "ez", product: "bav_avb", status: "loopt_af", eind_datum: "2026-10-25" }], { ez: "Let's GO labels" });
    expect(r?.opvolgingId).toBe("o1");
  });
  it("niet als de opvolger al een eigen contract heeft", () => {
    expect(openContractMeenemen("bv", opv, [
      { onderneming_id: "ez", product: "bav_avb", status: "actief", eind_datum: null },
      { onderneming_id: "bv", product: "bav_avb", status: "actief", eind_datum: null }], {})).toBeNull();
  });
  it("niet bij overname", () => {
    expect(openContractMeenemen("bv", [{ ...opv[0], soort: "overname" }], [{ onderneming_id: "ez", product: "bav_avb", status: "actief", eind_datum: null }], {})).toBeNull();
  });
  it("server: geen dubbele factuur, geen creditnota, nooit echte opzegging", () => {
    const f = fn("contract_meenemen_kern");
    expect(f).not.toMatch(/gefactureerd_tm\s*=/);
    expect(f).not.toMatch(/volgende_factuurdatum\s*=/);
    expect(f).not.toContain("plan_opzeg_credit");
    expect(f).toContain("'opzegging_verwerken','opzegging_verwerkt','einddatum_opzegging_bevestigd'");
    expect(f).toContain("de opvolger heeft al een eigen BAV + AVB-contract");
    expect(f).toContain("heeft een openstaande creditnota");
    expect(f).toContain("'opvolger_exact_machtiging'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.contract_meenemen_kern(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;");
  });
  it("ondernemingswijziging beeindigt het BAV-contract niet als het meegaat", () => {
    const f = fn("crm_ondernemingswijziging");
    expect(f).toContain("AND NOT (v_contract_mee AND product = 'bav_avb')");
    expect(f).toContain("public.contract_meenemen_kern(v_opv");
  });
});

describe("3. Afgehaakte aanvragen", () => {
  const basis = { status: "open", is_test: false, lead_id: null };
  it("teller: alleen zonder herinnering, niet gezien en zonder contact", () => {
    expect(vraagtHandeling(basis)).toBe(true);
    expect(vraagtHandeling({ ...basis, herinnering_verstuurd_op: "2026-11-03T10:00:00Z" })).toBe(false);
    expect(vraagtHandeling({ ...basis, gezien_op: "2026-11-04T08:00:00Z" })).toBe(false);
    expect(vraagtHandeling({ ...basis, contact_vastgelegd_op: "2026-11-04T08:00:00Z" })).toBe(false);
    expect(sql).toContain("AND herinnering_verstuurd_op IS NULL AND gezien_op IS NULL AND contact_vastgelegd_op IS NULL");
  });
  it("automatisch afronden 7 dagen na herinnering, behalve met contact", () => {
    expect(WACHTTIJD_DAGEN).toBe(7);
    const h = "2026-10-28T10:00:00Z";
    expect(afrondMoment(h)?.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(wordtAutomatischAfgerond({ ...basis, herinnering_verstuurd_op: h }, new Date("2026-11-04T09:00:00Z"))).toBe(false);
    expect(wordtAutomatischAfgerond({ ...basis, herinnering_verstuurd_op: h }, new Date("2026-11-04T11:00:00Z"))).toBe(true);
    expect(wordtAutomatischAfgerond({ ...basis, herinnering_verstuurd_op: h, contact_vastgelegd_op: "2026-11-01T00:00:00Z" }, new Date("2026-11-05T00:00:00Z"))).toBe(false);
    const f = fn("afhakers_automatisch_afronden");
    expect(f).toContain("herinnering_verstuurd_op <= now() - interval '7 days'");
    expect(f).toContain("AND contact_vastgelegd_op IS NULL");
  });
  it("oude belknoppen zijn weg, contact vastleggen staat erin", () => {
    const page = readFileSync("src/pages/admin/Afgehaakt.tsx", "utf8");
    expect(page).not.toContain('zetStatus(r, "gebeld")');
    expect(page).not.toContain('zetStatus(r, "onbereikbaar")');
    expect(page).toContain("afhaker_contact_vastleggen");
    expect(page).toContain("afhakers_gezien");
  });
});
