import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bavPakketten } from "@/data/bavPakketten";
import { renderZekerKennis } from "../../scripts/genereer-zeker-kennis";
import { ZEKER_KENNIS } from "../../supabase/functions/_shared/zekerKennis.generated";
import {
  bouwSysteemPrompt, bouwGeschiedenis, isToegestaneOrigin, maskeerGevoelig, rateLimitBeslissing,
  normaliseerActies, schoonAntwoord, ZEKER_LIMIET_10_MIN, ZEKER_LIMIET_DAG,
} from "../../supabase/functions/_shared/zeker";
import { parseMarkdownLite, isVeiligeLink } from "@/lib/zeker/markdownLite";
import { zekerVerborgenOp } from "@/components/zeker/zekerStore";

describe("Zeker kennisbasis", () => {
  it("gegenereerde kopie is byte-gelijk aan de bronnen (draai bun scripts/genereer-zeker-kennis.ts)", () => {
    expect(readFileSync("supabase/functions/_shared/zekerKennis.generated.ts", "utf8")).toBe(renderZekerKennis());
  });
  it("prijzen en dekkingen gelijk aan bavPakketten", () => {
    expect(ZEKER_KENNIS.pakketten.map((p) => [p.id, p.prijs, p.bav.perGebeurtenis, p.avb.perJaar])).toEqual(
      bavPakketten.map((p) => [p.id, p.prijs, p.dekkingen.bav.perGebeurtenis, p.dekkingen.avb.perJaar]));
    const prompt = bouwSysteemPrompt({ taal: "nl", artikelen: [] });
    for (const p of bavPakketten) expect(prompt).toContain(p.prijsLabel);
    expect(prompt).toContain("€ 5.000.000");
  });
  it("prompt bevat compliancegrenzen en geen interne sectorvlaggen", () => {
    const p = bouwSysteemPrompt({ taal: "en", artikelen: [{ slug: "wet-dba", title: "Wet DBA", excerpt: "x" }] });
    expect(p).toMatch(/nooit persoonlijk advies/);
    expect(p).toMatch(/Zeg nooit toe/);
    expect(p).toMatch(/BSN, IBAN/);
    expect(p).toMatch(/\/klachtenprocedure/);
    expect(p).toContain("/kennisbank/wet-dba");
    expect(p).not.toMatch(/handmatigeAcceptatie|handmatige beoordeling|sectorbeperkingen: zorg/);
    expect(JSON.stringify(ZEKER_KENNIS)).not.toMatch(/handmatige/i);
  });
});

describe("Zeker beveiliging", () => {
  it("origin-check", () => {
    for (const o of ["https://zpzaken.nl", "https://www.zpzaken.nl", "https://zzpproject.lovable.app", "https://id-preview--2e030441-024b-4841-be4b-93d91e428fb6.lovable.app"]) expect(isToegestaneOrigin(o)).toBe(true);
    for (const o of [null, "", "https://evil.com", "https://zpzaken.nl.evil.com", "https://andere-app.lovable.app"]) expect(isToegestaneOrigin(o)).toBe(false);
  });
  it("rate limit 20/10 min en 200/dag", () => {
    expect(rateLimitBeslissing({ laatste10Min: ZEKER_LIMIET_10_MIN - 1, vandaag: 0 }).ok).toBe(true);
    expect(rateLimitBeslissing({ laatste10Min: ZEKER_LIMIET_10_MIN, vandaag: 0 })).toEqual({ ok: false, reden: "10min" });
    expect(rateLimitBeslissing({ laatste10Min: 0, vandaag: ZEKER_LIMIET_DAG })).toEqual({ ok: false, reden: "dag" });
  });
  it("maskeert IBAN, BSN en wachtwoord, maar geen telefoonnummer", () => {
    const r = maskeerGevoelig("IBAN NL91 ABNA 0417 1643 00, bsn 123456782, wachtwoord: geheim, bel 0612345678");
    expect(r.gemaskeerd).toBe(true);
    expect(r.tekst).not.toMatch(/ABNA|123456782|geheim/);
    expect(r.tekst).toContain("0612345678");
  });
  it("geschiedenis komt alleen uit de server-rijen en wisselt rollen af", () => {
    const g = bouwGeschiedenis([{ rol: "assistant", tekst: "los" }, { rol: "user", tekst: "a" }, { rol: "assistant", tekst: "b" }, { rol: "user", tekst: "c" }], "d");
    expect(g[0].role).toBe("user");
    expect(g.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(g[2].content).toBe("c\n\nd");
  });
  it("acties en antwoordtekst worden opgeschoond", () => {
    expect(normaliseerActies({ acties: ["bellen", "hack", "bellen"], sector: "zorg" })).toEqual({ acties: ["bellen"], sector: "zorg" });
    expect(schoonAntwoord("**Hoi** [x](https://evil.com) [wa](https://wa.me/31652064589)")).toBe("Hoi x [wa](https://wa.me/31652064589)");
  });
  it("markdown-lite laat alleen veilige links door", () => {
    expect(isVeiligeLink("/offerte?sector=ict")).toBe(true);
    expect(isVeiligeLink("//evil.com")).toBe(false);
    expect(isVeiligeLink("javascript:alert(1)")).toBe(false);
    const b = parseMarkdownLite("Kijk [hier](/faq).\n- een\n- [x](https://evil.com)");
    expect(b[0].type).toBe("p");
    expect(b[1]).toEqual({ type: "ul", items: [[{ type: "text", text: "een" }], [{ type: "text", text: "x" }]] });
  });
  it("chat verborgen op beheer, portaal, Mijn ZP en screenshot-helper", () => {
    for (const p of ["/admin", "/admin/crm", "/portal/login", "/mijn-zp", "/en/mijn-zp/polis", "/screenshot-helper"]) expect(zekerVerborgenOp(p)).toBe(true);
    for (const p of ["/", "/faq", "/en/offerte"]) expect(zekerVerborgenOp(p)).toBe(false);
  });
});
