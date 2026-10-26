// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync,readdirSync } from "node:fs";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
const db=new PGlite();
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'select null::uuid';
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'select ''{}''::jsonb';
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'select ''service_role''::text';
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS 'select false';
    CREATE TABLE articles(id uuid primary key,slug text,title text,image_url text,published_at timestamptz,is_published boolean default false);
    CREATE TABLE article_image_jobs(article_id uuid unique,status text default 'pending',requested_at timestamptz);
    CREATE SCHEMA net;CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb) RETURNS bigint LANGUAGE sql AS 'select 1::bigint';`);
  const name=readdirSync("drizzle/migrations").find(n=>n.endsWith("artikel_fotos_f10.sql"));if(!name)throw new Error("Missing migration");
  await db.exec(readFileSync(`drizzle/migrations/${name}`,"utf8"));
  await db.exec(`CREATE TRIGGER old_images AFTER INSERT OR UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION artikel_afbeelding_wekken();`);
},30000);
afterAll(()=>db.close());
describe("F10 database regels",()=>{
 it("blokkeert publicatie zonder foto vanaf 27 oktober",async()=>{
  await expect(db.query(`INSERT INTO articles(id,slug,published_at,is_published) VALUES($1,'nieuw','2026-10-27 00:00:00+01',true)`,[id(1)])).rejects.toThrow("Publicatie geweigerd");
 });
 it("houdt oud artikel met bestaande afbeelding ongewijzigd",async()=>{
  await db.query(`INSERT INTO articles(id,slug,image_url,published_at,is_published) VALUES($1,'oud','/oud.jpg','2026-10-26 23:59:59+01',true)`,[id(2)]);
  const {rows}=await db.query<{image_url:string}>(`SELECT image_url FROM articles WHERE id=$1`,[id(2)]);expect(rows[0].image_url).toBe("/oud.jpg");
  await db.query(`INSERT INTO artikel_foto_inventaris(url,sha256,phash) VALUES('/oud.jpg',$1,$2)`,["a".repeat(64),"1".repeat(64)]);
 });
 it("foto-aanlevering maakt alleen fotojob, geen illustratiejob",async()=>{
  await db.query(`INSERT INTO articles(id,slug,foto_bron_url,published_at) VALUES($1,'foto','https://cdn.higgsfield.ai/test.webp','2026-10-27')`,[id(3)]);
  const {rows}=await db.query<{count:number}>(`SELECT count(*)::int count FROM artikel_foto_jobs WHERE article_id=$1`,[id(3)]);expect(rows[0].count).toBe(1);
  const images=await db.query<{count:number}>(`SELECT count(*)::int count FROM article_image_jobs WHERE article_id=$1`,[id(3)]);expect(images.rows[0].count).toBe(0);
 });
 it("exacte foto wordt atomair geweigerd door SQL",async()=>{
  await duplicate("a".repeat(64),"0000000000000000",4,"identieke foto");
 });
 it("bijna-dubbele foto wordt atomair geweigerd door SQL",async()=>{
  await duplicate("b".repeat(64),"ffffffffffffffff",5,"bijna-dubbele foto");
 });
});
async function duplicate(hash:string,phash:string,n:number,error:string){
 await db.query(`INSERT INTO articles(id,slug,foto_bron_url,published_at) VALUES($1,$2,'https://cdn.higgsfield.ai/test.webp','2026-10-27')`,[id(n),`foto-${n}`]);
 await db.query(`UPDATE artikel_foto_jobs SET lease=$1,lease_tot=now()+interval '1 minute' WHERE article_id=$2`,[id(99),id(n)]);
 const jobs=await db.query<{id:string}>(`SELECT id FROM artikel_foto_jobs WHERE article_id=$1`,[id(n)]);
 const path=`fotos/foto-${n}-${hash.slice(0,8)}.webp`;
 const photo={sha256:hash,bron_sha256:hash,phash,breedte:1600,hoogte:900,bron_host:"cdn.higgsfield.ai",storage_pad:path,image_url:`https://eugkavokktjwpqaqlwsj.supabase.co/storage/v1/object/public/article-images/${path}`};
 await expect(db.query(`SELECT artikel_foto_vastleggen($1,$2,$3::jsonb)`,[jobs.rows[0].id,id(99),JSON.stringify(photo)])).rejects.toThrow(error);
 const a=await db.query<{image_url:string|null}>(`SELECT image_url FROM articles WHERE id=$1`,[id(n)]);expect(a.rows[0].image_url).toBeNull();
}