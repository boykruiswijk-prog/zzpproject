// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fotoUrl, fotoAfmetingen, hashAfstand, fotoPublicatieGeldig, sha256, MAX_BYTES, PHASH_AFSTAND, downloadFoto } from "../../supabase/functions/artikel-foto/regels";
import { absoluteArticleOgImage } from "../lib/articleImage";
import { readFileSync, readdirSync } from "node:fs";
describe("F10 unieke artikelfoto", () => {
  it("staat uitsluitend de opgegeven CloudFront-host toe, geen wildcard", () => {
    expect(fotoUrl("https://d8j0ntlcm91z4.cloudfront.net/user_3KH9GxqJs9BYVFo7RIwIPMc7jpN/hf_20261026_134312_5ccc85c1-d184-44cd-b8ba-bf893f4e54d8.png").hostname).toBe("d8j0ntlcm91z4.cloudfront.net");
    expect(() => fotoUrl("https://d8j0ntlcm91z4.cloudfront.net.evil.test/x.png")).toThrow();
    expect(() => fotoUrl("https://another.cloudfront.net/x.png")).toThrow();
  });
  it("weigert identieke SHA256", async () => {
    const a = new Uint8Array([1,2,3]); const existing = [await sha256(a)];
    expect(existing.includes(await sha256(a))).toBe(true);
    expect(existing.includes(await sha256(new Uint8Array([1,2,4])))).toBe(false);
  });
  it("weigert bijna-dubbele perceptuele hashes tot en met afstand 8", () => {
    expect(hashAfstand("0000000000000000", "00000000000000ff")).toBe(PHASH_AFSTAND);
    expect(hashAfstand("0000000000000000", "00000000000001ff")).toBe(9);
  });
  it("weigert publicatie vanaf 27 oktober zonder geregistreerde foto", () => {
    expect(fotoPublicatieGeldig({ published_at:"2026-10-27T00:00:00+01:00", image_url:"/oud.png" },false)).toBe(false);
    expect(fotoPublicatieGeldig({ published_at:"2026-10-27T00:00:00+01:00", image_url:"https://example.org/article-images/fotos/test.webp" },false)).toBe(false);
    expect(fotoPublicatieGeldig({ published_at:"2026-10-27T00:00:00+01:00", image_url:"https://example.org/article-images/fotos/test.webp" },true)).toBe(true);
  });
  it("laat oude artikelen werken", () => {
    expect(fotoPublicatieGeldig({ published_at:"2026-10-26T23:59:59+01:00",image_url:"/oud.png" },false)).toBe(true);
  });
  it("blokkeert onbekende hosts, HTTP, gebruikersinfo en host-suffixtrucs", () => {
    expect(fotoUrl("https://cdn.higgsfield.ai/photo.webp").hostname).toBe("cdn.higgsfield.ai");
    for (const url of ["http://cdn.higgsfield.ai/a", "https://cdn.higgsfield.ai.evil.test/a", "https://user@cdn.higgsfield.ai/a", "https://127.0.0.1/a", "https://random.cloudfront.net/a"]) expect(() => fotoUrl(url)).toThrow();
  });
  it("weigert meer dan 15 MB voor download", async () => {
    await expect(downloadFoto(new URL("https://cdn.higgsfield.ai/x"), async () => new Response("x", {headers:{"content-type":"image/png","content-length":String(MAX_BYTES+1)}}))).rejects.toThrow("15 MB");
  });
  it("weigert pixelbommen voor decoderen", () => {
    const bytes = new Uint8Array(24); bytes.set([137,80,78,71]); const view = new DataView(bytes.buffer);
    view.setUint32(16,8000); view.setUint32(20,8000);
    expect(() => fotoAfmetingen(bytes)).toThrow("12 miljoen");
  });
  it("gebruikt foto OG-variant", () => {
    expect(absoluteArticleOgImage({slug:"test",image_url:"https://example.org/article-images/fotos/test.webp"})).toBe("https://example.org/article-images/fotos/test-og.webp");
  });
  it("illustratiewachtrij sluit aangeleverde foto's uit", () => {
    const name = readdirSync("drizzle/migrations").find(n => n.endsWith("artikel_fotos_f10.sql"));
    if (!name) throw new Error("F10 migratie ontbreekt");
    expect(readFileSync(`drizzle/migrations/${name}`,"utf8")).toContain("NEW.foto_bron_url IS NULL");
    expect(readFileSync("supabase/functions/artikel-afbeelding/index.ts","utf8")).toContain("|| article.foto_bron_url ||");
  });
});