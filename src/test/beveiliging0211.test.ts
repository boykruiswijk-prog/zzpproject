// @vitest-environment node
// Beveiligingscheck 2-11 (akkoord Boy): IBAN-leesrechten, formulieren en create-team-user.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { clientIp, guardPublicSubmission } from "../../supabase/functions/_shared/antiSpam";
import { isTestInzending } from "../../supabase/functions/_shared/testMarkering";
import { LEAD_KOLOMMEN, ONDERNEMING_KOLOMMEN, SCREENING_KOLOMMEN } from "@/lib/veiligeKolommen";
import { maskeerIbanKaart, maskeerIbanVol } from "@/components/admin/IbanInzien";
import { isValidIban } from "@/lib/sepaMachtiging";

const req = (h: Record<string, string>) => new Request("https://x.supabase.co/functions/v1/f", { method: "POST", headers: h });
const nepDb = () => {
  const q: any = { select: () => q, eq: () => q, not: () => q, gte: () => Promise.resolve({ count: 0 }), insert: () => Promise.resolve({}) };
  return { from: () => q } as any;
};

describe("formulieren", () => {
  it("IP komt uit cf-connecting-ip, niet uit een zelf meegestuurde x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", "cf-connecting-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
  });
  it("invultijd verplicht: zonder ms geweigerd, met geldige ms doorgelaten", async () => {
    const zonder = await guardPublicSubmission(req({}), nepDb(), { kind: "lead" });
    expect(zonder.ok).toBe(false);
    expect(zonder.reason).toBe("invultijd_ontbreekt");
    expect((await guardPublicSubmission(req({}), nepDb(), { kind: "lead", ms: "" })).ok).toBe(false);
    expect((await guardPublicSubmission(req({}), nepDb(), { kind: "lead", ms: 500 })).reason).toBe("too_fast");
    expect((await guardPublicSubmission(req({}), nepDb(), { kind: "lead", ms: 8000 })).ok).toBe(true);
    // Tussentijds opslaan hoort bij een formulier dat zelf de invultijd meestuurt.
    expect((await guardPublicSubmission(req({}), nepDb(), { kind: "concept" })).ok).toBe(true);
  });
  it("testmarkering alleen via intern adres, nooit via de Origin-header", () => {
    expect(isTestInzending("klant@voorbeeld.nl")).toBe(false);
    expect(isTestInzending("ellen@zpzaken.nl")).toBe(true);
    for (const f of ["submit-public-form", "process-bav-wizard", "process-klant-service", "kvk-uittreksel-upload"]) {
      const src = readFileSync(`supabase/functions/${f}/index.ts`, "utf8");
      expect(src, f).not.toMatch(/is_test:?\s*=?\s*!resolveEnvironment|isTestLead = !resolveEnvironment|is_test: !gate\.isProduction/);
    }
    expect(readFileSync("supabase/functions/_shared/testMarkering.ts", "utf8")).not.toMatch(/headers\.get/);
  });
});

describe("create-team-user", () => {
  const src = readFileSync("supabase/functions/create-team-user/index.ts", "utf8");
  it("vaste rollenlijst, wachtwoord minimaal 12 tekens, logregel per aanmaak", () => {
    expect(src).toContain('TOEGESTANE_ROLLEN = ["admin", "supervisor", "medewerker", "verzekering", "marketing"]');
    expect(src).toContain("MIN_WACHTWOORD = 12");
    expect(src).toContain("!TOEGESTANE_ROLLEN.includes(role)");
    expect(src).toMatch(/password\.length < MIN_WACHTWOORD/);
    expect(src).toContain('actie: "teamlid_aangemaakt"');
    expect(src.indexOf("TOEGESTANE_ROLLEN.includes")).toBeLessThan(src.indexOf("auth.admin.createUser"));
    expect(readFileSync("src/pages/admin/Team.tsx", "utf8")).toContain("minLength={12}");
  });
});

describe("IBAN: geen leesrecht voor teamrollen", () => {
  const typen = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const rowKolommen = (tabel: string) => {
    const start = typen.indexOf(`      ${tabel}: {\n        Row: {`);
    const blok = typen.slice(start, typen.indexOf("        Insert:", start));
    return [...blok.matchAll(/^ {10}(\w+)\??:/gm)].map((m) => m[1]);
  };
  it.each([["leads", LEAD_KOLOMMEN], ["ondernemingen", ONDERNEMING_KOLOMMEN], ["screening_aanvragen", SCREENING_KOLOMMEN]])(
    "%s: kolomlijst = alle kolommen behalve iban", (tabel, lijst) => {
      const verwacht = rowKolommen(tabel).filter((k) => k !== "iban").sort();
      expect(lijst.split(",").sort()).toEqual(verwacht);
      expect(lijst.split(",")).not.toContain("iban");
    });
  it("migratie trekt SELECT op IBAN-kolommen in en gebruikt de gelogde RPC", () => {
    const sql = readFileSync("drizzle/migrations/0218_iban_kolomrechten.sql", "utf8");
    for (const t of ["leads", "ondernemingen", "bav_aanmeldingen", "screening_aanvragen", "sepa_machtiging_bewijs", "exact_mandaat_import", "klant_mandaten"]) expect(sql).toContain(`'${t}'`);
    expect(sql).toContain("REVOKE SELECT ON public.%I FROM anon, authenticated");
    expect(sql).toContain("NOT IN ('iban','voorkeur_iban')");
    expect(sql).toContain("REVOKE SELECT ON public.klant_mandaat_v FROM anon, authenticated");
  });
  it("beheercode leest nooit * of iban rechtstreeks uit deze tabellen", () => {
    const bestanden: string[] = [];
    const loop = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!["test", "integrations"].includes(f)) loop(p); } else if (/\.tsx?$/.test(f)) bestanden.push(p); } };
    loop("src");
    const fout: string[] = [];
    const re = /from\("(leads|ondernemingen|screening_aanvragen|bav_aanmeldingen|sepa_machtiging_bewijs|klant_mandaten|exact_mandaat_import|klant_mandaat_v)"\)[^;]{0,400}?\.select\((\)|"\*"|"[^"]*\biban\b)/g;
    for (const p of bestanden) {
      const s = readFileSync(p, "utf8");
      for (const m of s.matchAll(re)) fout.push(`${p}: ${m[0].slice(0, 80)}`);
      if (/ondernemingen\([^)]*\biban\b/.test(s)) fout.push(`${p}: embedded iban`);
    }
    expect(fout).toEqual([]);
  });
});

describe("IBAN-masker in SQL", () => {
  const db = new PGlite();
  beforeAll(async () => {
    const sql = readFileSync("drizzle/migrations/0218_iban_kolomrechten.sql", "utf8");
    const a = sql.indexOf("CREATE OR REPLACE FUNCTION public.iban_skelet");
    await db.exec(sql.slice(a, sql.indexOf("CREATE OR REPLACE FUNCTION public.iban_maskers")));
  }, 30000);
  afterAll(() => db.close());
  it.each(["NL91ABNA0417164300", "nl91 abna 0417 1643 00", "NL91ABNA0417164301", "DE89370400440532013000", "BE68539007547034", "NL00", ""])(
    "%s: skelet toont hetzelfde masker en geldigheid gelijk aan de browsercontrole", async (iban) => {
      const r = (await db.query<{ s: string | null; g: boolean }>("select public.iban_skelet($1) s, public.iban_mod97_geldig($1) g", [iban])).rows[0];
      expect(r.g).toBe(isValidIban(iban));
      if (iban.replace(/\s/g, "").length >= 12) {
        expect(maskeerIbanKaart(r.s)).toBe(maskeerIbanKaart(iban));
        expect(maskeerIbanVol(r.s)).toBe(maskeerIbanVol(iban));
        expect(r.s).not.toContain("041716");
      }
    });
});
