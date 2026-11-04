import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bavKopTekst, omzetReden, openOmzetting, polisMeenemenMogelijk } from "@/lib/omzetting";

const EZ = "ffe71ac0-e2ab-4bfc-8ad1-f912ac924eb2";
const BV = "a5af4c71-b816-4c4e-9ccc-d299ae71e22a";
const opv = [{ id: "13cc18ad-ff45-443c-a56e-f0468cec246d", van_onderneming_id: EZ, naar_onderneming_id: BV, soort: "rechtsvormwijziging", ingangsdatum: "2026-11-03" }];
const namen = { [EZ]: "Volpracht" };

describe("opvolging en omzetting samen", () => {
  it("polis nog bij voorganger: omzetting staat open", () => {
    const o = openOmzetting(BV, opv, [{ id: "p1", onderneming_id: EZ, status: "geldig", certificate_number: "ZPBAV4100" }], namen);
    expect(o?.policyId).toBe("p1");
    expect(o?.ingangsdatum).toBe("2026-11-03");
    expect(o?.vanNaam).toBe("Volpracht");
  });

  it("BV-kaart toont geen BAV-nummer zolang de polis niet op de BV staat", () => {
    const o = openOmzetting(BV, opv, [{ id: "p1", onderneming_id: EZ, status: "geldig", certificate_number: "ZPBAV4100" }], namen);
    expect(bavKopTekst("ZPBAV4100", o)).toBe("BAV-nummer wordt overgenomen van Volpracht");
  });

  it("polis staat op de BV: niets open en het nummer is zichtbaar", () => {
    const o = openOmzetting(BV, opv, [{ id: "p1", onderneming_id: BV, status: "geldig", certificate_number: "ZPBAV4100" }], namen);
    expect(o).toBeNull();
    expect(bavKopTekst("ZPBAV4100", o)).toBe("BAV-nummer ZPBAV4100");
  });

  it("overname of ingetrokken polis: geen automatische omzetting", () => {
    expect(openOmzetting(BV, [{ ...opv[0], soort: "overname" }], [{ id: "p1", onderneming_id: EZ, status: "geldig", certificate_number: "X" }], namen)).toBeNull();
    expect(openOmzetting(BV, opv, [{ id: "p1", onderneming_id: EZ, status: "ingetrokken", certificate_number: "X" }], namen)).toBeNull();
  });

  it("polis meenemen alleen bij rechtsvormwijziging met geldige polis; reden haalt de minimumlengte", () => {
    expect(polisMeenemenMogelijk("rechtsvormwijziging", { id: "p" })).toBe(true);
    expect(polisMeenemenMogelijk("overname", { id: "p" })).toBe(false);
    expect(polisMeenemenMogelijk("rechtsvormwijziging", null)).toBe(false);
    expect(omzetReden(opv[0].id).length).toBeGreaterThanOrEqual(10);
  });

  it("SQL: meenemen beeindigt de polis niet en maakt geen taak 'polis kan niet worden overgezet'", () => {
    const sql = readFileSync("drizzle/migrations/0239_opvolging_omzetting_samenvoegen.sql", "utf8");
    expect(sql).toMatch(/v_mee boolean := coalesce\(_polis_meenemen,false\) AND _soort = 'rechtsvormwijziging'/);
    expect(sql).toMatch(/IF NOT v_mee THEN SELECT array_agg\(id\) INTO v_p FROM public.policies/);
    expect(sql).toMatch(/IF NOT v_mee AND \(v_nieuw.kvk/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public.polis_omzetten_kern\([^)]*\) FROM PUBLIC, anon, authenticated/);
  });

  it("systeemopdracht alleen via eenmalig token en nooit mail", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(src).toContain('rpc("omzetting_systeem_claim"');
    expect(src).toMatch(/\? \{ actie: "omzetten"/);
  });
});
