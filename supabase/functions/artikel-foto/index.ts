// Empty public wake processes only SQL-enqueued jobs; never accepts caller URLs or prompts.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { fotoUrl, downloadFoto, hashAfstand, PHASH_AFSTAND } from "./regels.ts";
import { verwerkFoto, fotoHashes } from "./verwerk.ts";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const raw = await req.text();
  if (raw.length > 100 || (raw.trim() && raw.trim() !== "{}")) return json({ error: "Geen invoer toegestaan" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const lease = crypto.randomUUID();
  const { data: jobs, error } = await admin.rpc("artikel_foto_claim", { p_lease: lease });
  if (error) return json({ error: "Fotowachtrij niet beschikbaar" }, 500);
  const job = jobs?.[0];
  if (!job) {
    await admin.from("artikel_foto_worker").update({ lease: null, lease_tot: null }).eq("lease", lease);
    return json({ status: "geen_werk_of_bezet" });
  }
  let host: string | null = null;
  try {
    const { data: article, error: articleError } = await admin.from("articles").select("id,slug,image_url,foto_bron_url").eq("id", job.article_id).single();
    if (articleError || !article || article.image_url || article.foto_bron_url !== job.bron_url) throw new Error("Artikel gewijzigd; bestaande afbeelding behouden");
    if (!/^[A-Za-z0-9_-]+$/.test(article.slug)) throw new Error("Ongeldige artikelslug");
    const url = fotoUrl(job.bron_url); host = url.hostname;
    const result = await verwerkFoto(await downloadFoto(url));
    // Inventory changes are hashed in small batches; fail closed until every current URL is covered.
    const { data: articles, error: inventoryReadError } = await admin.from("articles").select("image_url").not("image_url", "is", null).limit(10000);
    const { data: inventory, error: hashReadError } = await admin.from("artikel_foto_inventaris").select("url,sha256,phash").limit(10000);
    const { data: photos, error: photoReadError } = await admin.from("artikel_fotos").select("image_url,sha256,bron_sha256,phash").limit(10000);
    if (inventoryReadError || hashReadError || photoReadError || articles?.length === 10000 || inventory?.length === 10000 || photos?.length === 10000) throw new Error("Fotoinventaris niet volledig leesbaar");
    const known = new Set([...(inventory ?? []).map(i => i.url), ...(photos ?? []).map(i => i.image_url)]);
    const missing = [...new Set((articles ?? []).map(a => a.image_url).filter((u): u is string => Boolean(u) && !known.has(u)))];
    for (const existing of missing.slice(0, 3)) {
      const old = new URL(existing);
      const storageOrigin = new URL(Deno.env.get("SUPABASE_URL") ?? "").origin;
      if (!((old.origin === storageOrigin && old.pathname.startsWith("/storage/v1/object/public/article-images/")) || old.origin === "https://zpzaken.nl")) throw new Error("Bestaande foto vereist gecontroleerde inventarisatie");
      const hashes = await fotoHashes(await downloadFoto(old));
      const inserted = await admin.from("artikel_foto_inventaris").insert({ url: existing, sha256: hashes.sha256, phash: BigInt(`0x${hashes.phash}`).toString(2).padStart(64,"0") });
      if (inserted.error && inserted.error.code !== "23505") throw new Error("Inventaris opslaan mislukt");
    }
    if (missing.length) {
      await admin.from("artikel_foto_jobs").update({ reden: `Inventarisatie bestaande foto's: nog ${Math.max(0, missing.length - 3)}`, lease: null, lease_tot: null }).eq("id",job.id).eq("lease",lease);
      return json({ status: "wacht", reden: "Bestaande foto's worden gecontroleerd" });
    }
    const all = [...(inventory ?? []), ...(photos ?? [])];
    if (all.some(i => i.sha256 === result.sha256 || i.sha256 === result.bron_sha256 || ("bron_sha256" in i && i.bron_sha256 === result.bron_sha256))) throw new Error("Foto geweigerd: identieke foto bestaat al");
    if (all.some(i => hashAfstand(BigInt(`0b${i.phash}`).toString(16), result.phash) <= PHASH_AFSTAND)) throw new Error("Foto geweigerd: bijna-dubbele foto bestaat al");
    const path = `fotos/${article.slug}-${result.sha256.slice(0,8)}.webp`;
    for (const [name, bytes] of [[path.replace(/\.webp$/, "-og.webp"), result.og], [path, result.webp]] as const) {
      const uploaded = await admin.storage.from("article-images").upload(name, bytes, { contentType: "image/webp", upsert: false });
      if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw new Error("Foto opslaan mislukt");
    }
    const imageUrl = admin.storage.from("article-images").getPublicUrl(path).data.publicUrl;
    const saved = await admin.rpc("artikel_foto_vastleggen", { p_job: job.id, p_lease: lease, p_foto: { storage_pad: path, image_url: imageUrl, bron_host: host, sha256: result.sha256, bron_sha256: result.bron_sha256, phash: result.phash, breedte: result.width, hoogte: result.height } });
    if (saved.error) throw new Error(saved.error.message);
    return json({ status: "klaar", image_url: imageUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Fotoverwerking mislukt";
    await admin.from("artikel_foto_jobs").update({ status: "geweigerd", reden: reason, bron_host: host, lease: null, lease_tot: null, completed_at: new Date().toISOString() }).eq("id", job.id).eq("lease", lease);
    await admin.from("artikel_foto_log").insert({ article_id: job.article_id, job_id: job.id, status: "geweigerd", reden: reason, bron_host: host });
    return json({ status: "geweigerd", reden: reason });
  } finally {
    await admin.from("artikel_foto_worker").update({ lease: null, lease_tot: null }).eq("lease", lease);
    // No cron secret: the next queued wake is SQL-owned and contains no caller input.
    EdgeRuntime.waitUntil((async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const next = await admin.rpc("artikel_foto_dispatch");
      if (next.error) console.error("Fotowachtrij wacht op volgende SQL-oproep");
    })());
  }
});