// Empty public wake processes only SQL-inserted rows; never accepts caller URLs.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.108.2/cors";
import { initPhoton, PhotonImage, resize, crop, SamplingFilter } from "npm:@cf-wasm/photon@0.4.0/others";
import { fotoUrl, downloadFoto, fotoAfmetingen } from "./regels.ts";

const BUCKET = "article-images"; // Public buckets are blocked in this workspace; ads live under ad-images/.
const MAX_JPG = 5 * 1024 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
let ready: Promise<unknown> | undefined;
async function init() {
  ready ??= (async () => {
    const res = await fetch("https://cdn.jsdelivr.net/npm/@cf-wasm/photon@0.4.0/dist/lib/photon_rs_bg.wasm", { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error("Beeldconversie niet beschikbaar");
    return initPhoton({ module_or_path: new Uint8Array(await res.arrayBuffer()) });
  })();
  await ready;
}

async function coverJpg(bytes: Uint8Array, w: number, h: number): Promise<Uint8Array> {
  const dim = fotoAfmetingen(bytes); await init();
  const image = PhotonImage.new_from_byteslice(bytes);
  try {
    const scale = Math.max(w / dim.width, h / dim.height);
    const cover = resize(image, Math.max(w, Math.ceil(dim.width * scale)), Math.max(h, Math.ceil(dim.height * scale)), SamplingFilter.Lanczos3);
    try {
      const x = Math.floor((cover.get_width() - w) / 2), y = Math.floor((cover.get_height() - h) / 2);
      const out = crop(cover, x, y, x + w, y + h);
      try {
        if (out.get_width() !== w || out.get_height() !== h) throw new Error("Uitsnede heeft verkeerde afmetingen");
        for (const q of [88, 80, 70]) { const jpg = out.get_bytes_jpeg(q); if (jpg.length <= MAX_JPG) return jpg; }
        throw new Error("JPG groter dan 5 MB");
      } finally { out.free(); }
    } finally { cover.free(); }
  } finally { image.free(); }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const raw = await req.text();
  if (raw.length > 100 || (raw.trim() && raw.trim() !== "{}")) return json({ error: "Geen invoer toegestaan" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const results: unknown[] = [];
  for (let i = 0; i < 5; i++) {
    const lease = crypto.randomUUID();
    const { data, error } = await admin.rpc("advertentie_beeld_claim", { p_lease: lease });
    if (error) return json({ error: "Wachtrij niet beschikbaar" }, 500);
    const row = data?.[0];
    if (!row) break;
    try {
      const jpg = await coverJpg(await downloadFoto(fotoUrl(row.bron_url)), row.breedte, row.hoogte);
      const path = `ad-images/${row.id}.jpg`;
      const up = await admin.storage.from(BUCKET).upload(path, jpg, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw new Error("Opslaan mislukt");
      const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await admin.from("advertentie_beelden").update({ status: "klaar", resultaat_url: url, fout: null, lease: null, lease_tot: null }).eq("id", row.id).eq("lease", lease);
      results.push({ id: row.id, status: "klaar" });
    } catch (e) {
      const fout = e instanceof Error ? e.message : "Verwerking mislukt";
      await admin.from("advertentie_beelden").update({ status: "geweigerd", fout, lease: null, lease_tot: null }).eq("id", row.id).eq("lease", lease);
      results.push({ id: row.id, status: "geweigerd" });
    }
  }
  return json({ results });
});
