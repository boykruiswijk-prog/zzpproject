import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { contractLabel, contractRegel } from "@/lib/klantContractPortaal";

(globalThis as any).Deno = { env: { get: () => "" } };
const log = await import("../../supabase/functions/_shared/portalMailLog.ts");

describe("Mijn ZP voor bestaande klanten zonder online aanvraag", () => {
  it("toont BAV & AVB met certificaatnummer of startdatum", () => {
    expect(contractLabel("bav_avb")).toBe("BAV & AVB");
    expect(contractLabel("cyber")).toBe("Cyberverzekering");
    expect(contractRegel({ product: "bav_avb", status: "actief", begin_datum: "2024-11-29", certificaatnummer: "ZPBAV4100", onderneming_naam: null })).toBe("Certificaat ZPBAV4100");
    expect(contractRegel({ product: "bav_avb", status: "actief", begin_datum: "2025-02-21", certificaatnummer: null, onderneming_naam: null })).toBe("Actief sinds 21-02-2025");
  });
  it("database-functie leest alleen het bevestigde eigen adres en actieve niet-testcontracten", () => {
    const sql = readFileSync("drizzle/migrations/0224_mijn_zp_bestaande_klanten.sql", "utf8");
    expect(sql).toMatch(/u\.id = auth\.uid\(\) AND u\.email_confirmed_at IS NOT NULL/);
    expect(sql).toMatch(/kc\.status = 'actief' AND coalesce\(kc\.is_test, false\) = false/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.mijn_klant_contracten\(\) FROM PUBLIC, anon/);
  });
});

describe("naam-plaatsaanduidingen", () => {
  it("'-' en '- -' zijn geen naam", () => {
    expect(log.echteNaam("- -")).toBeNull();
    expect(log.echteNaam("-")).toBeNull();
    expect(log.echteNaam("  ")).toBeNull();
    expect(log.echteNaam("Eric Olaf")).toBe("Eric Olaf");
  });
});

describe("afleverstatus portaalmails", () => {
  it("vertaalt Resend-status naar gewone taal", () => {
    expect(log.afleverLabel("delivered")).toBe("afgeleverd");
    expect(log.afleverLabel("bounced")).toBe("geweigerd door ontvanger");
    expect(log.afleverLabel(null)).toBe("onbekend");
  });
  it("haalt status op en valt terug op null bij fout", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ last_event: "delivered" }), { status: 200 }));
    expect(await log.resendStatus("abc", "k", ok as any)).toBe("delivered");
    const nok = vi.fn(async () => new Response("x", { status: 404 }));
    expect(await log.resendStatus("abc", "k", nok as any)).toBeNull();
  });
  it("uitnodigfunctie handelt een open portaltoegang-aanvraag mee af en levert het log", () => {
    const src = readFileSync("supabase/functions/crm-portal-uitnodigen/index.ts", "utf8");
    expect(src).toMatch(/\.eq\("type", "portaltoegang"\)\.eq\("onderneming_id", ondId\)\.ilike\("email", email\)\.eq\("status", "nieuw"\)/);
    expect(src).toMatch(/modus === "log"/);
    expect(src).toMatch(/voornaam: echteNaam\(p\.voornaam\)/);
  });
});

describe("klantpolissen zonder aanvraag horen bij het Mijn ZP-account", () => {
  it("nieuwe klantpolis krijgt het enige bevestigde account van de onderneming", () => {
    const sql = readFileSync("drizzle/migrations/0225_polis_onderneming_portal_koppeling.sql", "utf8");
    expect(sql).toMatch(/count\(DISTINCT u\.id\) = 1/);
    expect(sql).toMatch(/NEW\.user_id IS NULL AND NEW\.lead_id IS NULL AND NEW\.onderneming_id IS NOT NULL/);
    expect(sql).toMatch(/email_confirmed_at IS NOT NULL/);
  });
  it("uitnodigen koppelt ongekoppelde klantpolissen van die onderneming", () => {
    const src = readFileSync("supabase/functions/crm-portal-uitnodigen/index.ts", "utf8");
    expect(src).toMatch(/\.eq\("onderneming_id", ondId\)\.is\("lead_id", null\)\.is\("user_id", null\)/);
  });
});
