// deno-lint-ignore-file no-explicit-any
// image-migrate: haalt de afbeeldingen (en de PDF's) van de oude WordPress-site
// naar Supabase storage, zodat de kennisbank na de cutover niet afhankelijk is
// van img.poweredcache.net (een pull-zone vóór de WordPress-origin).
//
// mode = "dryrun" -> alleen rapport, downloadt niets, schrijft niets weg
// mode = "import" -> downloadt het origineel, uploadt en herschrijft
//                    de artikelcontent + image_url
//
// Alleen aanroepbaar door een ingelogd teamlid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SOURCE = "https://zpzaken.nl";
const BUCKET = "article-images";
const UA = { "user-agent": "ZPZaken-ImageMigrate/1.0" };

// Alle verwijzingen naar de oude site: direct of via de poweredcache pull-zone.
const OLD_URL_RE =
  /https?:\/\/(?:img\.poweredcache\.net\/(?:www\.)?zpzaken\.nl|(?:www\.)?zpzaken\.nl)\/wp-content\/uploads\/[^\s)"'<>]+/gi;

const RASTER = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"]);

// Let op: omzetten naar webp in de edge function is niet mogelijk. De
// ImageMagick-WASM-runtime overschrijdt het geheugenbudget van de function
// (WORKER_RESOURCE_LIMIT). De bestanden worden daarom 1-op-1 bewaard in hun
// originele formaat; bestanden groter dan GROOT_BYTES worden in het rapport
// gemarkeerd zodat ze later gericht geoptimaliseerd kunnen worden.
const GROOT_BYTES = 400 * 1024;

interface Doel {
  /** pad binnen wp-content/uploads, zonder WordPress-formaatsuffix */
  uploadPath: string;
  /** originele bron op de WordPress-origin */
  originUrl: string;
  ext: string;
}

/** Zet elke oude URL (CDN-variant of origin) om naar het originele bronpad. */
export function normaliseer(oldUrl: string): Doel | null {
  const m = oldUrl.match(/\/wp-content\/uploads\/([^?#]+)/i);
  if (!m) return null;
  let rel = decodeURIComponent(m[1]).replace(/^\/+/, "");
  const ext = (rel.split(".").pop() ?? "").toLowerCase();
  // WordPress-formaatsuffix (-800x413) weghalen: we willen het origineel.
  if (RASTER.has(ext)) rel = rel.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]+$)/i, "");
  return { uploadPath: `wp-content/uploads/${rel}`, originUrl: `${SOURCE}/wp-content/uploads/${rel}`, ext };
}

function storagePath(d: Doel): string {
  return d.uploadPath;
}

function publicUrl(base: string, path: string) {
  return `${base}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: user.id });
    if (!isTeam) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "import" ? "import" : "dryrun";
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(0, Math.min(500, Number(body.limit))) : 0;
    const includePdf = body?.pdfs !== false;

    // 1. Alle artikelen met een verwijzing naar de oude site.
    const { data: articles, error: artErr } = await admin
      .from("articles")
      .select("id,slug,content,image_url");
    if (artErr) throw artErr;

    // 2. Unieke doelbestanden verzamelen, met per doel alle oude URL-varianten.
    const doelen = new Map<string, { doel: Doel; varianten: Set<string>; artikelen: Set<string> }>();
    const registreer = (raw: string, slug: string) => {
      const doel = normaliseer(raw);
      if (!doel) return;
      const key = doel.uploadPath.toLowerCase();
      const entry = doelen.get(key) ?? { doel, varianten: new Set<string>(), artikelen: new Set<string>() };
      entry.varianten.add(raw);
      entry.artikelen.add(slug);
      doelen.set(key, entry);
    };

    for (const a of articles ?? []) {
      const slug = String((a as any).slug);
      for (const raw of String((a as any).content ?? "").match(OLD_URL_RE) ?? []) registreer(raw, slug);
      const img = (a as any).image_url as string | null;
      if (img && OLD_URL_RE.test(img)) registreer(img, slug);
      OLD_URL_RE.lastIndex = 0;
    }

    // 3. PDF's uit de mediabibliotheek van de oude site (nog niet herschrijven,
    //    alleen bewaren zodat ze na de cutover via een redirect bereikbaar zijn).
    const pdfs: { url: string; storage_path: string; status: string; bytes?: number; reden?: string }[] = [];
    if (includePdf) {
      try {
        const res = await fetch(`${SOURCE}/wp-json/wp/v2/media?per_page=100&media_type=application`, {
          headers: { ...UA, accept: "application/json" },
        });
        if (res.ok) {
          const list = await res.json();
          for (const it of Array.isArray(list) ? list : []) {
            const url = String(it?.source_url ?? "");
            if (!/\.pdf$/i.test(url) || !/\/wp-content\/uploads\//i.test(url)) continue;
            const d = normaliseer(url);
            if (d) pdfs.push({ url: d.originUrl, storage_path: d.uploadPath, status: "nieuw" });
          }
        }
      } catch { /* PDF-inventarisatie mag de afbeeldingen niet blokkeren */ }
    }

    // 4. Wat staat er al in storage? (idempotent: niet opnieuw downloaden)
    const bestaat = async (path: string) => {
      const dir = path.split("/").slice(0, -1).join("/");
      const name = path.split("/").pop()!;
      const { data } = await admin.storage.from(BUCKET).list(dir, { search: name, limit: 100 });
      return (data ?? []).some((f: any) => f.name === name);
    };

    const rapport: any[] = [];
    let gelukt = 0;
    let mislukt = 0;
    let overgeslagen = 0;
    let bytesVoor = 0;
    let bytesNa = 0;
    let verwerkt = 0;

    const rewrites = new Map<string, string>(); // oude URL -> nieuwe URL

    for (const [, entry] of doelen) {
      if (limit && verwerkt >= limit) break;
      verwerkt++;
      const { doel, varianten, artikelen } = entry;
      const path = storagePath(doel);
      const nieuweUrl = publicUrl(SUPABASE_URL, path);
      const row: any = {
        origin_url: doel.originUrl,
        storage_path: path,
        nieuwe_url: nieuweUrl,
        varianten: [...varianten],
        artikelen: [...artikelen],
        status: "nieuw",
      };

      const aanwezig = await bestaat(path);
      if (aanwezig) {
        row.status = "bestond_al";
        overgeslagen++;
        for (const v of varianten) rewrites.set(v, nieuweUrl);
        rapport.push(row);
        continue;
      }

      if (mode === "dryrun") {
        rapport.push(row);
        continue;
      }

      try {
        // Origineel eerst; alleen als dat niet bestaat de CDN-variant.
        let res = await fetch(doel.originUrl, { headers: UA });
        row.bron = "origin";
        if (!res.ok) {
          const fallback = [...varianten][0];
          res = await fetch(fallback, { headers: UA });
          row.bron = "cdn-variant";
          if (!res.ok) throw new Error(`http_${res.status}`);
        }
        let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await res.arrayBuffer());
        row.bytes_voor = bytes.length;
        bytesVoor += bytes.length;

        if (bytes.length > GROOT_BYTES) row.groot = true;

        const contentType =
          res.headers.get("content-type")?.split(";")[0] ||
          ({ webp: "image/webp", svg: "image/svg+xml", gif: "image/gif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" } as Record<string, string>)[doel.ext] ||
          "application/octet-stream";

        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType, upsert: false });
        if (upErr) throw new Error(upErr.message);

        row.bytes_na = bytes.length;
        bytesNa += bytes.length;
        row.status = "gemigreerd";
        gelukt++;
        for (const v of varianten) rewrites.set(v, nieuweUrl);
      } catch (e) {
        row.status = "mislukt";
        row.reden = (e as Error).message;
        mislukt++;
      }
      rapport.push(row);
    }

    // 5. PDF's: alleen downloaden en bewaren, geen herschrijving.
    for (const p of pdfs) {
      if (await bestaat(p.storage_path)) {
        p.status = "bestond_al";
        continue;
      }
      if (mode === "dryrun") continue;
      try {
        const res = await fetch(p.url, { headers: UA });
        if (!res.ok) throw new Error(`http_${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(p.storage_path, bytes, { contentType: "application/pdf", upsert: false });
        if (error) throw new Error(error.message);
        p.bytes = bytes.length;
        p.status = "gemigreerd";
      } catch (e) {
        p.status = "mislukt";
        p.reden = (e as Error).message;
      }
    }

    // 6. Artikelcontent en image_url herschrijven.
    const aangepasteArtikelen: { slug: string; content: boolean; image_url: boolean }[] = [];
    if (mode === "import" && rewrites.size) {
      const gesorteerd = [...rewrites.entries()].sort((a, b) => b[0].length - a[0].length);
      for (const a of articles ?? []) {
        const orig = String((a as any).content ?? "");
        let content = orig;
        for (const [oud, nieuw] of gesorteerd) content = content.split(oud).join(nieuw);
        let imageUrl = (a as any).image_url as string | null;
        const origImg = imageUrl;
        if (imageUrl) for (const [oud, nieuw] of gesorteerd) imageUrl = imageUrl!.split(oud).join(nieuw);
        const contentChanged = content !== orig;
        const imgChanged = imageUrl !== origImg;
        if (!contentChanged && !imgChanged) continue;
        const patch: any = {};
        if (contentChanged) patch.content = content;
        if (imgChanged) patch.image_url = imageUrl;
        const { error } = await admin.from("articles").update(patch).eq("id", (a as any).id);
        if (!error) {
          aangepasteArtikelen.push({ slug: String((a as any).slug), content: contentChanged, image_url: imgChanged });
        }
      }
    }

    if (mode === "import" && (gelukt > 0 || aangepasteArtikelen.length > 0)) {
      try {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        await admin.from("activiteiten_log").insert({
          actie_type: "image_migrate",
          omschrijving: `Afbeeldingsmigratie: ${gelukt} bestanden naar storage, ${aangepasteArtikelen.length} artikelen herschreven`,
          uitgevoerd_door: user.id,
          uitgevoerd_door_naam: (profile as any)?.full_name || user.email || "admin",
        });
      } catch { /* logging mag flow niet blokkeren */ }
    }

    const resterend = Math.max(0, doelen.size - verwerkt);

    return json({
      success: true,
      mode,
      bucket: BUCKET,
      samenvatting: {
        artikelen_gescand: (articles ?? []).length,
        bestanden_gevonden: doelen.size,
        bestanden_verwerkt: verwerkt,
        resterend,
        gemigreerd: gelukt,
        bestond_al: overgeslagen,
        mislukt,
        bytes_voor: bytesVoor,
        bytes_na: bytesNa,
        pdfs_gevonden: pdfs.length,
        pdfs_gemigreerd: pdfs.filter((p) => p.status === "gemigreerd").length,
        pdfs_mislukt: pdfs.filter((p) => p.status === "mislukt").length,
        artikelen_aangepast: aangepasteArtikelen.length,
      },
      artikelen_aangepast: aangepasteArtikelen,
      pdfs,
      rapport,
    });
  } catch (e) {
    return json({ error: "internal_error", detail: (e as Error).message }, 500);
  }
});
