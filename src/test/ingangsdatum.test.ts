import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { vroegsteIngangsdatum, ingangsdatumFout, corrigeerIngangsdatum, nlDag } from "@/lib/ingangsdatum";

describe("vroegsteIngangsdatum (besluit D4)", () => {
  it("rond middernacht telt de Nederlandse dag", () => {
    expect(vroegsteIngangsdatum("2026-10-13T21:59:00Z")).toBe("2026-10-14"); // 23:59 NL op 13 okt
    expect(vroegsteIngangsdatum("2026-10-13T22:01:00Z")).toBe("2026-10-15"); // 00:01 NL op 14 okt
  });
  it("wintertijd (25 okt 2026, 03:00 wordt 02:00)", () => {
    expect(nlDag("2026-10-24T22:30:00Z")).toBe("2026-10-25"); // 00:30 CEST
    expect(vroegsteIngangsdatum("2026-10-24T22:30:00Z")).toBe("2026-10-26");
    expect(vroegsteIngangsdatum("2026-10-25T22:59:00Z")).toBe("2026-10-26"); // 23:59 CET
    expect(vroegsteIngangsdatum("2026-10-25T23:00:00Z")).toBe("2026-10-27");
  });
  it("zomertijd (29 mrt 2026, 02:00 wordt 03:00)", () => {
    expect(vroegsteIngangsdatum("2026-03-28T23:30:00Z")).toBe("2026-03-30"); // 00:30 CET op 29 mrt
    expect(vroegsteIngangsdatum("2026-03-29T21:59:00Z")).toBe("2026-03-30"); // 23:59 CEST
    expect(vroegsteIngangsdatum("2026-03-29T22:00:00Z")).toBe("2026-03-31");
  });
  it("jaarwisseling", () => expect(vroegsteIngangsdatum("2026-12-31T12:00:00Z")).toBe("2027-01-01"));
});

describe("formuliervalidatie", () => {
  const nu = "2026-10-13T10:00:00Z";
  it("weigert vandaag en eerder met een nette melding", () => {
    expect(ingangsdatumFout("2026-10-13", nu)).toBe("De ingangsdatum is vroegst morgen (14-10-2026).");
    expect(ingangsdatumFout("2026-10-01", nu)).toContain("vroegst morgen");
  });
  it("staat morgen en later toe, en laat een leeg veld aan de verplicht-controle", () => {
    expect(ingangsdatumFout("2026-10-14", nu)).toBeNull();
    expect(ingangsdatumFout("2027-01-01", nu)).toBeNull();
    expect(ingangsdatumFout("", nu)).toBeNull();
  });
  it("server corrigeert naar de dag na de aanvraag", () => {
    expect(corrigeerIngangsdatum("2026-10-13", nu)).toEqual({ oud: "2026-10-13", nieuw: "2026-10-14" });
    expect(corrigeerIngangsdatum("2026-10-20", nu)).toBeNull();
  });
});

describe("alle plekken gebruiken de gedeelde regel", () => {
  const lees = (p: string) => readFileSync(p, "utf8");
  it("formulieren zetten min op morgen", () => {
    for (const p of ["src/components/home/BAVApplicationModule.tsx", "src/pages/OffertePage.tsx", "src/components/verzekeringen/OnlineAanvraagDialog.tsx", "src/components/admin/IngangsdatumAanpassen.tsx"]) {
      expect(lees(p), p).toContain("vroegsteIngangsdatum(");
    }
  });
  it("server corrigeert en activeren blokkeert", () => {
    expect(lees("supabase/functions/process-bav-wizard/index.ts")).toContain("corrigeerIngangsdatum(");
    expect(lees("supabase/functions/process-bav-wizard/index.ts")).not.toContain("niet in het verleden liggen");
    expect(lees("supabase/functions/lead-to-exact-activate/index.ts")).toContain("Pas eerst de ingangsdatum aan (vroegst");
  });
  it("database: trigger en RPC-check staan in de migratie", () => {
    const sql = lees("drizzle/migrations/0121_ingangsdatum_vroegst_dag_na_aanvraag.sql");
    expect(sql).toContain("BEFORE INSERT ON public.leads");
    expect(sql).toContain("BEFORE INSERT ON public.bav_aanmeldingen");
    expect(sql).toContain("vroegst de dag na de aanvraag");
    expect(sql).toContain("Europe/Amsterdam");
  });
});
