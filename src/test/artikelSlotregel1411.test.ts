// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/migrations/0290_artikel_slotregel_f1_1411.sql", "utf8");
const previous = readFileSync("drizzle/migrations/0286_artikel_beroepsnaam_adviseur_blokkade_1311.sql", "utf8");
const melding = "Artikel geweigerd: slotregel algemene informatie en/of Stand van zaken ontbreekt (register F1).";
async function scenario(test: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE articles(title text, excerpt text, content text, seo_title text, seo_description text, foto_alt text, is_published boolean, published_at timestamptz);`);
    await db.exec(migration);
    await db.exec("BEGIN");
    await test(db);
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT count(*)::int AS n FROM articles")).rows).toEqual([{ n: 0 }]);
  } finally { await db.close(); }
}
async function geweigerd(db: PGlite, sql: string, args: unknown[] = []) {
  await db.exec("SAVEPOINT poging");
  await expect(db.query(sql, args)).rejects.toThrow(melding);
  await db.exec("ROLLBACK TO SAVEPOINT poging");
}
describe("Register F1 vanaf 14 november Amsterdam", () => {
  it("laat alle bestaande inhoudelijke controles byte-gelijk", () => {
    expect(migration.startsWith(previous.slice(0, previous.indexOf("  RETURN NEW;")))).toBe(true);
    expect(migration).toMatch(/UPDATE OF[^;]*is_published, published_at/);
  });
  for (const content of ["Zonder slotregel", "algemene informatie", "stand van zaken", null]) {
    it(`weigert nieuw artikel met ontbrekende regel: ${content}`, () => scenario(async db => {
      await geweigerd(db, "INSERT INTO articles(content,is_published,published_at) VALUES ($1,true,'2026-11-13T23:00:00Z')", [content]);
    }));
  }
  it("weigert alleen publiceren van concept, ook met published_at null", () => scenario(async db => {
    await db.exec("INSERT INTO articles(content,is_published,published_at) VALUES ('concept',false,null)");
    await geweigerd(db, "UPDATE articles SET is_published=true");
  }));
  it("accepteert beide regels hoofdletterongevoelig op de grens en bij null", () => scenario(async db => {
    await db.exec("INSERT INTO articles(content,is_published,published_at) VALUES ('ALGEMENE INFORMATIE. STAND VAN ZAKEN: 14 november 2026.',true,'2026-11-13T23:00:00Z'), ('Algemene informatie. Stand van zaken.',true,null)");
    expect((await db.query("SELECT count(*)::int AS n FROM articles")).rows).toEqual([{ n: 2 }]);
  }));
  it("oud artikel vlak voor grens mag zonder slotregels bijgewerkt worden", () => scenario(async db => {
    await db.exec("INSERT INTO articles(content,is_published,published_at) VALUES ('oud',true,'2026-11-13T22:59:59Z'); UPDATE articles SET content='oud bijgewerkt'");
    expect((await db.query("SELECT content FROM articles")).rows).toEqual([{ content: "oud bijgewerkt" }]);
  }));
  it("datumwijziging naar grens kan de controle niet omzeilen", () => scenario(async db => {
    await db.exec("INSERT INTO articles(content,is_published,published_at) VALUES ('oud',true,'2026-11-13T22:59:59Z')");
    await geweigerd(db, "UPDATE articles SET published_at='2026-11-13T23:00:00Z'");
  }));
});