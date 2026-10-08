// Public wake-up processes only database-enqueued articles, never caller-supplied prompts.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import satori from 'npm:satori@0.10.14';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import { categoryDesign, illustrationPrompt } from './design.ts';
import { illustration, inspectIllustration, GatewayError } from './ai.ts';
import { kiesBeeld } from './kiesBeeld.ts';
import { requireSupervisor } from '../_shared/teamAuth.ts';
const BUCKET = 'article-images';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
let ready: Promise<{ fonts: unknown[]; logo: string }> | null = null;
function init() {
 ready ??= (async () => {
  await initWasm(fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'));
  const font = async (weight: number) => ({ name: 'Plus Jakarta Sans', weight, style: 'normal', data: await (await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${weight}-normal.woff`)).arrayBuffer() });
  const data = new Uint8Array(await (await fetch('https://zpzaken.nl/logo.png')).arrayBuffer());
  let bin = ''; for (const byte of data) bin += String.fromCharCode(byte);
  return { fonts: [await font(700), await font(800)], logo: `data:image/png;base64,${btoa(bin)}` };
 })();
 return ready;
}
// deno-lint-ignore no-explicit-any
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): any => ({ type, key: null, props: { style, children, ...extra } });
async function render(title: string, category: string | null, image?: string, hero = false): Promise<Uint8Array> {
 const { fonts, logo } = await init();
 const palette = categoryDesign(category);
 const width = hero ? 1600 : 1200, height = hero ? 900 : 630;
 const children = image ? [h('img', { position: 'absolute', width, height, objectFit: 'cover' }, undefined, { src: `data:image/png;base64,${image}`, width, height })] : [
  ...[0,1,2,3,4].map(i => h('div', { position: 'absolute', right: 40 + i * 70, top: 35 + i * 50, width: 340, height: 340, border: `2px solid ${palette.accent}`, opacity: 0.08, transform: `rotate(${15 + i * 7}deg)` }))
 ];
 if (!hero) children.push(
  h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: image ? 255 : 630, display: 'flex', flexDirection: 'column', justifyContent: image ? 'center' : 'flex-start', padding: image ? '28px 60px 60px' : '110px 110px 0', backgroundColor: image ? '#1F2D47' : palette.background }, [
   h('div', { fontSize: image ? 20 : 26, fontWeight: 700, color: palette.accent }, (category || 'KENNISBANK').toUpperCase()),
   h('div', { display: 'block', marginTop: image ? 12 : 28, fontSize: image ? 40 : 60, fontWeight: 800, lineHeight: 1.05, color: image ? '#FFFFFF' : palette.ink, lineClamp: 3, textOverflow: 'ellipsis', overflow: 'hidden', maxHeight: image ? 126 : 189, wordBreak: 'break-word' }, title),
  ]),
  h('img', { position: 'absolute', left: image ? 60 : 110, bottom: image ? 14 : 60, height: image ? 32 : 56, objectFit: 'contain' }, undefined, { src: logo, height: image ? 32 : 56 }),
  h('div', { position: 'absolute', right: image ? 60 : 110, bottom: image ? 20 : 60, fontSize: image ? 20 : 28, fontWeight: 700, color: image ? '#B8C2D6' : palette.ink }, 'zpzaken.nl')
 );
 const svg = await satori(h('div', { width, height, display: 'flex', position: 'relative', overflow: 'hidden', backgroundColor: palette.background, fontFamily: 'Plus Jakarta Sans' }, children), { width, height, fonts: fonts as never });
 const renderer = new Resvg(svg);
 try { return renderer.render().asPng(); } finally { renderer.free(); }
}
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
 if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
 const raw = await req.text();
 if (raw.length > 100 || (raw.trim() && raw.trim() !== '{}')) return json({ error: 'Geen invoer toegestaan' }, 400);
 const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
 const { data: worker } = await admin.from('article_image_worker').select('wake_token').eq('id',true).maybeSingle();
 const internal = Boolean(worker?.wake_token && req.headers.get('x-article-wake-token') === worker.wake_token);
 if (!internal) {
  const auth = await requireSupervisor(req, admin);
  if (auth instanceof Response) return new Response(auth.body, { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 }
 const depth = Number(req.headers.get('x-article-depth') ?? '8');
 if (!Number.isInteger(depth) || depth < 1 || depth > 8) return json({ error: 'Ongeldig werkbudget' },400);
 const lease = crypto.randomUUID();
 const { data: claimed, error: claimError } = await admin.rpc('claim_article_image_worker', { p_lease: lease });
 if (claimError) return json({ error: 'Wachtrij niet beschikbaar' }, 500);
 if (!claimed) return json({ ok: true, status: 'bezet_of_gepauzeerd' });
 try {
  // 'running' zonder lease = vorige verwerking afgebroken (bijv. CPU-limiet): opnieuw oppakken.
  const { data: jobs, error } = await admin.from('article_image_jobs').select('article_id,attempts,status').in('status',['pending','running']).order('requested_at').limit(1);
  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return json({ ok: true, status: 'geen_werk' });
  const afgebroken = job.status === 'running';
  const { data: article } = await admin.from('articles').select('id,slug,title,category,excerpt,image_url,is_published').eq('id',job.article_id).single();
  // Explicit replacement jobs only target our generated files; never custom images.
  if (!article || !article.is_published || (article.image_url && !article.image_url.includes('/article-images/generated/'))) {
   await admin.from('article_image_jobs').update({ status: 'skipped', completed_at: new Date().toISOString() }).eq('article_id',job.article_id);
   return json({ ok: true, status: 'eigen_afbeelding_behouden' });
  }
  await admin.from('article_image_jobs').update({ status: 'running' }).eq('article_id',job.article_id);
  const key = Deno.env.get('LOVABLE_API_KEY');
  // Na een afgebroken poging direct de lichte huisstijl-terugval: nooit langer zonder beeld.
  const keuze = afgebroken ? { image: undefined, reason: 'Vorige verwerking afgebroken', attempts: job.attempts ?? 0, structureel: false } : await kiesBeeld(
   key ? (attempt) => illustration(illustrationPrompt(article, attempt), key) : null,
   (img) => inspectIllustration(img, key!),
   (e) => e instanceof GatewayError && (e.status === 402 || e.status === 403 || e.status === 404 || e.terminal),
  );
  const image = keuze.image, reason = keuze.reason, usedAttempts = keuze.attempts;
  console.log(JSON.stringify({ slug: article.slug, attempts: usedAttempts, type: image ? 'illustration' : 'fallback', reason }));
  // Structurele AI-weigering: admin-melding, nooit pauze; terugval loopt altijd door.
  if (keuze.structureel) await admin.from('article_image_worker').update({ ai_melding: reason, ai_melding_op: new Date().toISOString() }).eq('id', true);
  const stamp = `${article.slug}-${Date.now()}-${lease.slice(0,8)}`;
  const path = image ? `generated/${stamp}-illustration.png` : `generated/${stamp}-fallback.png`;
  try {
   if (image) {
    // OG eerst (zwaarste stap); artikelbeeld is de ruwe illustratie zonder extra rendering.
    const og = await render(article.title, article.category, image);
    const ogUpload = await admin.storage.from(BUCKET).upload(path.replace('-illustration.png','-og.png'), og, { contentType: 'image/png', upsert: false });
    if (ogUpload.error) throw ogUpload.error;
   }
   const png = image ? Uint8Array.from(atob(image), c => c.charCodeAt(0)) : await render(article.title, article.category);
   const upload = await admin.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: false });
   if (upload.error) throw upload.error;
   const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
   let update = admin.from('articles').update({ image_url: url }).eq('id',article.id);
   update = article.image_url ? update.eq('image_url',article.image_url) : update.is('image_url',null);
   const changed = await update.select('id');
   if (changed.error || !changed.data?.length) throw new Error('Artikel gewijzigd tijdens generatie; bestaande afbeelding behouden');
   await admin.from('article_image_jobs').update({ status: image ? 'completed' : 'fallback', attempts: usedAttempts, image_url: url, error: reason, completed_at: new Date().toISOString() }).eq('article_id',article.id);
   return json({ ok: true, slug: article.slug, url, type: image ? 'illustration' : 'fallback', attempts: usedAttempts, warning: reason });
  } catch (e) {
   await admin.from('article_image_jobs').update({ status: 'failed', error: e instanceof Error ? e.message : 'Opslag mislukt', attempts: usedAttempts }).eq('article_id',article.id);
   throw e;
  }
 } catch (e) {
  console.error('[artikel-afbeelding]', e instanceof Error ? e.message : 'Verwerking mislukt');
  return json({ ok: false, error: 'Artikelafbeelding niet verwerkt' }, 500);
 } finally {
  await admin.from('article_image_worker').update({ lease_id: null, lease_until: null }).eq('id',true).eq('lease_id',lease);
  const { data: state } = await admin.from('article_image_worker').select('wake_token').eq('id',true).single();
  const { count } = await admin.from('article_image_jobs').select('article_id', { count: 'exact', head: true }).eq('status','pending');
  if (depth > 1 && count && state?.wake_token) {
   EdgeRuntime.waitUntil((async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/artikel-afbeelding`, {
     method: 'POST', headers: { 'Content-Type': 'application/json', 'x-article-wake-token': state.wake_token, 'x-article-depth': String(depth - 1) }, body: '{}'
    });
    // Geen pauze: de cron (elke 5 minuten) pakt resterend werk op.
    if (!response.ok) console.error('[artikel-afbeelding] vervolgverwerking', response.status);
   })());
  }
 }
});
