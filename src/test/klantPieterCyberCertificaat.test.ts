// @vitest-environment node
// Melding Ellen 25-10: cyber toevoegen en BAV-certificaat bij klant met actieve polis.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { certificaatBlokkadeReden } from "@/lib/certificaatBlokkade";
import { zetInPlanner } from "../../supabase/functions/_shared/klantContractActivatie";

const vandaag = "2026-10-25";

describe("BAV-certificaat blokkade", () => {
  it("actief contract (ook met ingang vandaag of eerder) blokkeert nooit", () => {
    expect(certificaatBlokkadeReden([{ type: "verzekering", status: "actief", eind_datum: null }], vandaag)).toBeNull();
  });
  it("geen contract op deze kaart: duidelijke reden, geen 'opgezegd'", () => {
    expect(certificaatBlokkadeReden([], vandaag)).toMatch(/geen BAV \+ AVB-contract/);
  });
  it("opgezegd contract blijft geblokkeerd", () => {
    expect(certificaatBlokkadeReden([{ type: "verzekering", status: "beeindigd", eind_datum: "2026-10-01" }], vandaag)).toMatch(/opgezegd of afgelopen/);
  });
  it("BAV-certificaatroute kent het cyberjaarmaximum niet", () => {
    expect(readFileSync("supabase/functions/generate-certificate/index.ts", "utf8")).not.toMatch(/CYBER_JAARMAXIMUM/);
    expect(readFileSync("src/components/admin/KlantCertificaat.tsx", "utf8")).not.toMatch(/CYBER_JAARMAXIMUM/);
  });
});

describe("cyber toevoegen voor het team", () => {
  const mig = readdirSync("drizzle/migrations").filter((f) => f.includes("cyber_toevoegen_team_zonder_account"))[0];
  const sql = readFileSync(`drizzle/migrations/${mig}`, "utf8");
  const mogelijk = sql.split("CREATE OR REPLACE FUNCTION public.cyber_toevoegen_aanvragen")[0];
  it("geen Mijn ZP-account vereist en leadstatus telt niet als er een actief contract is", () => {
    expect(mogelijk).not.toMatch(/user_id IS NOT NULL/);
    expect(mogelijk).not.toMatch(/l\.id IS NULL OR l\.status/);
  });
  it("klant zelf heeft wel een eigen account nodig; team niet", () => {
    expect(sql).toMatch(/NOT _namens_klant AND \(p\.user_id IS NULL OR p\.user_id IS DISTINCT FROM auth\.uid\(\)\)/);
  });
  it("blok toont reden en geen testrecordschakelaar", () => {
    const ui = readFileSync("src/components/portal/CyberToevoegen.tsx", "utf8");
    expect(ui).not.toMatch(/ToonTestrecordsSchakelaar/);
    expect(ui).toMatch(/cyber_toevoegen_redenen/);
  });
});

describe("activatie hergebruikt klantkaart met zelfde KvK", () => {
  function nep(ondernemingen: any[]) {
    const contracten: any[] = [];
    const q = (tabel: string) => {
      const f: [string, unknown][] = [];
      const rows = () => (tabel === "ondernemingen" ? ondernemingen : []).filter((r) => f.every(([k, v]) => r[k] === v));
      const api: any = {
        select: () => api, eq: (k: string, v: unknown) => { f.push([k, v]); return api; },
        is: (k: string, v: unknown) => { f.push([k, v]); return api; },
        limit: () => ({ ...api, then: (res: any) => res({ data: rows() }) }),
        maybeSingle: async () => ({ data: rows()[0] ?? null }),
        update: (u: any) => { const a: any = { eq: (k: string, v: unknown) => { f.push([k, v]); return a; }, is: (k: string, v: unknown) => { f.push([k, v]); rows().forEach((r) => Object.assign(r, u)); return Promise.resolve({ error: null }); } }; return a; },
        insert: (row: any) => { const r = { id: "nieuw", ...row }; ondernemingen.push(r); return { select: () => ({ single: async () => ({ data: r, error: null }) }) }; },
        upsert: async (row: any) => { contracten.push(row); return { error: null }; },
      };
      return api;
    };
    return { from: q, contracten, ondernemingen };
  }
  it("geen tweede kaart als er precies één kaart met dit KvK-nummer is", async () => {
    const sb = nep([{ id: "bestaand", kvk: "92654193", is_test: true, exact_account_id: null }]);
    const r = await zetInPlanner(sb, { id: "33333333-3333-3333-3333-333333333333", kvk_nummer: "92654193", is_test: true }, "acc-9",
      { cyclus: "jaar", itemcode: "100J", bedrag_per_periode: 600, periodeStart: "2026-10-23", periodeEind: "2027-10-22" });
    expect(r).toMatchObject({ ok: true, onderneming_id: "bestaand" });
    expect(sb.ondernemingen).toHaveLength(1);
    expect(sb.contracten[0].onderneming_id).toBe("bestaand");
  });
});

describe("akkoord cyber blijft staan als certificaat nog niet kan", () => {
  const src = readFileSync("supabase/functions/cyber-toevoegen-activeren/index.ts", "utf8");
  it("certificaatfout geeft succes met wachtstatus, geen 409 en geen mail", () => {
    const blok = src.slice(src.indexOf("generate-certificate`"), src.indexOf("Existing certificate mail first"));
    expect(blok).toMatch(/success: true, status: "actief".*certificaat: "wacht", mail: "wacht_op_certificaat"/);
    expect(blok).not.toMatch(/409/);
  });
  it("cybercertificaatknop meldt jaarbedrag in gewone taal", () => {
    expect(readFileSync("supabase/functions/generate-cyber-certificate/index.ts", "utf8")).toMatch(/Cybercertificaat nog niet beschikbaar: jaarbedrag wordt vastgesteld door Boy/);
  });
});
