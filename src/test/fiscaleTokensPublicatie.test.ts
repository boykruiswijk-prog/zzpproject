import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveFiscaleTokens } from "@/lib/fiscaleTokens";
import { markdownToSafeHtml } from "../../scripts/markdownToSafeHtml";
import { fiscaleTokenCompact, oplosbareFiscaleTokens } from "../../scripts/fiscaleTokenSql";

const ARTIKEL = [
  "## Zelfstandigenaftrek van {{fiscaal:zelfstandigenaftrek:euro}} naar {{fiscaal:zelfstandigenaftrek:2027\\_euro}}",
  "",
  "De startersaftrek gaat van {{fiscaal:startersaftrek:euro}} naar {{fiscaal:startersaftrek:2027_euro}}.",
  "",
  "**Bestaat de startersaftrek nog in 2027?**",
  "Ja, maar nog maar {{fiscaal:startersaftrek:2027\\_euro}}.",
].join("\n");

describe("Artikel met fiscale tokens rendert zonder ruwe tokens", () => {
  it("ArtikelDetail-route (ReactMarkdown), inclusief geescapete underscore", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, resolveFiscaleTokens(ARTIKEL)),
    );
    expect(html).not.toContain("{{fiscaal:");
    expect(html).toContain("<h2>Zelfstandigenaftrek van 1.200 euro naar 900 euro</h2>");
    expect(html).toContain("2.123 euro naar 10 euro");
  });
  it("prerender-route (markdownToSafeHtml)", () => {
    const html = markdownToSafeHtml(resolveFiscaleTokens(ARTIKEL));
    expect(html).not.toContain("{{fiscaal:");
    expect(html).toContain("900 euro");
    expect(html).toContain("10 euro");
  });
  it("prerender weigert een pagina met onopgeloste token", () => {
    const src = readFileSync("scripts/prerender.ts", "utf8");
    expect(src).toMatch(/onopgeloste placeholder/);
  });
});

describe("Publicatiecontrole database volgt de resolver", () => {
  const migratie = readFileSync("drizzle/migrations/0289_artikel_fiscaal_token_check_1311.sql", "utf8");
  it("sleutellijst in de migratie is gelijk aan fiscaleCijfers", () => {
    const sql = /_sleutels constant text\[\] := ARRAY\[([^\]]*)\]/.exec(migratie)![1];
    expect(sql).toBe(fiscaleTokenCompact().map((t) => `'${t}'`).join(","));
  });
  it("SQL-regels leveren exact de oplosbare tokens van de resolver", () => {
    const sqlSet: string[] = [];
    for (const rij of fiscaleTokenCompact()) {
      const [s, e, j] = rij.split(":");
      const jaren = j.split(",");
      const v = ["", "waarde", "jaar", "label", "volledig", "bron", ...jaren];
      if (e === "E") v.push("euro", ...jaren.map((x) => `${x}_euro`));
      for (const x of v) sqlSet.push(`${s}|${x}`);
    }
    expect(sqlSet.sort()).toEqual(oplosbareFiscaleTokens().vast);
  });
});
