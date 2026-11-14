// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.articles(title text, excerpt text, content text, seo_title text, seo_description text, foto_alt text, is_published boolean, published_at timestamptz DEFAULT '2026-10-01');`);
  const migrations = readdirSync("drizzle/migrations").filter(f => f.endsWith(".sql"));
  const latest = migrations.filter(f => readFileSync(`drizzle/migrations/${f}`, "utf8").includes("CREATE OR REPLACE FUNCTION public.artikel_hiscox_acceptatie_check()")).sort().at(-1);
  if (!latest) throw new Error("Artikelcontrole ontbreekt");
  await db.exec(readFileSync(`drizzle/migrations/${latest}`, "utf8"));
  // Replay the latest trigger definition too, not the original trigger without is_published.
  const triggerMigration = migrations.filter(f => readFileSync(`drizzle/migrations/${f}`, "utf8").includes("CREATE TRIGGER artikel_hiscox_acceptatie_check")).sort().at(-1);
  if (!triggerMigration) throw new Error("Artikeltrigger ontbreekt");
  const triggerSql = readFileSync(`drizzle/migrations/${triggerMigration}`, "utf8");
  await db.exec(triggerSql.slice(triggerSql.indexOf("DROP TRIGGER IF EXISTS artikel_hiscox_acceptatie_check")));
  return db;
}

describe("CYBERBLAD 11: publicatieguard", () => {
  for (const woorden of ["cybervoorwaarden, die je opvraagt via contact", "cybervoorwaarden opvragen", "voorwaarden voor cyber vraag je op via contact"]) {
    it(`weigert gepubliceerd: ${woorden}`, async () => {
      const db = await setup();
      try { await expect(db.query("insert into articles(content,is_published) values ($1,true)", [woorden])).rejects.toThrow(); }
      finally { await db.close(); }
    });
  }
  it("staat online voorwaarden toe", async () => {
    const db = await setup();
    try { await db.query("insert into articles(content,is_published) values ($1,true)", ["De cybervoorwaarden vind je op [zpzaken.nl/voorwaarden#cyber](/voorwaarden#cyber)."]); }
    finally { await db.close(); }
  });
  it("weigert ook alleen het publiceren van een oud concept", async () => {
    const db = await setup();
    try {
      await db.query("insert into articles(content,is_published) values ($1,false)", ["De cybervoorwaarden vraag je op via contact."]);
      await expect(db.exec("update articles set is_published=true")).rejects.toThrow("cybervoorwaarden staan op /voorwaarden#cyber");
    } finally { await db.close(); }
  });
  it("begrensd tot 120 tekens na de voorwaardenwoorden", async () => {
    const db = await setup();
    try {
      await expect(db.query("insert into articles(content,is_published) values ($1,true)", ["cybervoorwaarden" + " ".repeat(120) + "opvragen"])).rejects.toThrow();
      await db.query("insert into articles(content,is_published) values ($1,true)", ["cybervoorwaarden" + " ".repeat(121) + "opvragen"]);
    } finally { await db.close(); }
  });
});