// Maakt voor gepubliceerde artikelen zonder image_url direct een huisstijlafbeelding
// (zelfde ontwerp als scripts/articleImages.ts), zet die in storage en vult image_url
// alleen als die nog leeg is. Neemt geen invoer aan: verwerkt uitsluitend wat de
// database als "zonder afbeelding" kent, dus veilig zonder inlog (gewekt door trigger).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import satori from "npm:satori@0.10.14";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

const BUCKET = "article-images";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

let ready: Promise<{ fonts: unknown[]; logo: string }> | null = null;
function init() {
  ready ??= (async () => {
    await initWasm(fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"));
    const font = async (w: number) => ({
      name: "Plus Jakarta Sans", weight: w, style: "normal",
      data: await (await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${w}-normal.woff`)).arrayBuffer(),
    });
    const logoBuf = new Uint8Array(await (await fetch("https://zpzaken.nl/logo.png")).arrayBuffer());
    let bin = ""; for (const b of logoBuf) bin += String.fromCharCode(b);
    return { fonts: [await font(700), await font(800)], logo: `data:image/png;base64,${btoa(bin)}` };
  })();
  return ready;
}

// deno-lint-ignore no-explicit-any
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): any =>
  ({ type, key: null, props: { style, children, ...extra } });

async function render(title: string, category: string | null): Promise<Uint8Array> {
  const { fonts, logo } = await init();
  const svg = await satori(h("div", {
    width: 1200, height: 630, display: "flex", flexDirection: "column", padding: "110px 110px 0", position: "relative",
    backgroundImage: "linear-gradient(160deg, #1F2D47, #16213A)", fontFamily: "Plus Jakarta Sans",
  }, [
    h("div", { position: "absolute", top: 0, right: 0, width: 800, height: 630, backgroundImage: "radial-gradient(ellipse at top right, rgba(238,62,44,0.13), transparent 70%)" }),
    h("div", { fontSize: 26, fontWeight: 700, letterSpacing: "0.12em", color: "#EE3E2C" }, (category || "KENNISBANK").toUpperCase()),
    h("div", { display: "block", marginTop: 28, fontSize: 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#FFFFFF", lineClamp: 3, textOverflow: "ellipsis", overflow: "hidden", maxHeight: 189, wordBreak: "break-word" }, title),
    h("img", { position: "absolute", left: 110, bottom: 60, height: 56, objectFit: "contain" }, undefined, { src: logo, height: 56 }),
    h("div", { position: "absolute", right: 110, bottom: 60, fontSize: 28, fontWeight: 700, color: "#B8C2D6" }, "zpzaken.nl"),
  ]), { width: 1200, height: 630, fonts: fonts as never });
  return new Resvg(svg).render().asPng();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: rows, error } = await admin.from("articles").select("id, slug, title, category")
    .eq("is_published", true).is("image_url", null).limit(20);
  if (error) return json({ ok: false, fout: "lezen mislukt" }, 500);
  const resultaat: { slug: string; ok: boolean }[] = [];
  for (const a of rows ?? []) {
    if (!a.slug || !/^[A-Za-z0-9_-]+$/.test(a.slug)) continue;
    try {
      const png = await render(a.title, a.category);
      const pad = `generated/${a.slug}-${Date.now()}.png`;
      const up = await admin.storage.from(BUCKET).upload(pad, png, { contentType: "image/png", upsert: false });
      if (up.error) throw up.error;
      const url = admin.storage.from(BUCKET).getPublicUrl(pad).data.publicUrl;
      // Nooit een bestaande afbeelding overschrijven.
      await admin.from("articles").update({ image_url: url }).eq("id", a.id).is("image_url", null);
      resultaat.push({ slug: a.slug, ok: true });
    } catch (e) {
      console.error("[artikel-afbeelding]", a.slug, String(e).slice(0, 200));
      resultaat.push({ slug: a.slug, ok: false });
    }
  }
  return json({ ok: true, resultaat });
});
