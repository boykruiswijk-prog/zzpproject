// deno-lint-ignore-file no-explicit-any
// wp-import: eenmalige contentmigratie van de oude WordPress-site (zpzaken.nl)
// naar public.articles. Alleen aanroepbaar door een ingelogd teamlid.
//
// mode = "dryrun"  -> alleen rapport, schrijft niets weg
// mode = "import"  -> importeert nieuwe slugs met is_published = false
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { htmlToMarkdown, stripHtml } from "./html2md.ts";
import { legacyRedirectMap } from "../_shared/legacyRedirects.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SOURCE = "https://zpzaken.nl";

const PRIORITEIT = [
  "bijdrage-zorgverzekeringswet-zzp",
  "hoe-zit-het-met-reiskosten-als-zzp-er",
  "hoeveel-kan-je-als-zzp-er-verdienen-zonder-belasting-te-moeten-betalen",
  "uurtarief-berekenen-zzper",
  "auto-van-de-zaak-of-prive",
  "hoe-bereken-ik-mijn-inkomen-als-zzp-er-naast-loondienst",
  "zzp-of-eenmanszaak",
  "zzp-aftrekposten",
  "inschrijven-bij-de-kamer-van-koophandel",
  "kleineondernemersregeling-kor",
  "alles-over-een-zzp-factuur",
  "is-eten-en-drinken-aftrekbaar-als-zzp-er",
  "zzp-er-met-een-bv-wat-zijn-de-voor-en-nadelen",
  "wet-toekomst-pensioenen-wtp-voor-zzp-ers",
  "welke-verzekeringen-zzp",
  "wat-kosten-verzekeringen-voor-zzp-ers",
  "rijd-je-als-zzp-er-fiscaal-voordelig-met-een-youngtimer",
  "voordelen-van-zzp",
  "hoeveel-opdrachtgevers-zzp",
  "hoe-combineer-je-loondienst-en-zzp",
  "wet-deregulering-beoordeling-arbeidsrelaties-dba",
  "zelfstandigenwet-voor-zzp-ers",
  "wat-is-de-zelfstandigenaftrek",
  "cyberverzekering-zzp",
  "zzp-en-belasting",
  "vbar-wet-verduidelijking-beoordeling-arbeidsrelaties-en-rechtsvermoeden",
  "starten-met-ondernemen-als-zzper",
  "wanneer-zelfstandig-ondernemer-voor-de-belastingdienst",
  "nieuwe-regels-zzp",
  "ondernemingsplan",
  "wat-is-startersaftrek",
  "hoe-bereken-ik-bijtelling-als-zzper",
  "wat-is-het-urencriterium",
  "voor-en-nadelen-broodfonds-of-schenkkring",
  "kleinschaligheidsinvesteringsaftrek-kia-voor-zzpers",
  "zzp-administratie-en-boekhouding",
  "eherkenning",
  "verplichte-aov-voor-zzp",
  "schijnzelfstandigheid-als-zzp-er",
  "btw-aangifte-zzp",
  "hypotheek-berekenen-en-afsluiten-als-zzp-er",
];

// articles.category bevat het label van een subrubriek uit article_categories.
// Deze labels horen bij de vier hubs: wet-en-regelgeving, ondernemen,
// belastingen, financien.
const HUB_CATEGORY: Record<string, { hub: string; label: string }> = {
  "wet-en-regelgeving": { hub: "wet-en-regelgeving", label: "Regelgeving" },
  belastingen: { hub: "belastingen", label: "Fiscaal" },
  financien: { hub: "financien", label: "Financiën" },
  ondernemen: { hub: "ondernemen", label: "Nieuws" },
  verzekeringen: { hub: "ondernemen", label: "Verzekeringen" },
};

const RULES: { hub: string; words: RegExp }[] = [
  {
    hub: "wet-en-regelgeving",
    words:
      /(wet |wetgeving|wet-|dba|vbar|schijnzelfstandig|arbeidsrelatie|rechtsvermoeden|zelfstandigenwet|nieuwe regels|regelgeving|handhaving|urencriterium|opdrachtgevers|wtp|pensioenen|concurrentiebeding|relatiebeding|aow)/i,
  },
  {
    hub: "belastingen",
    words:
      /(belasting|btw|fiscaal|fiscale|aftrek|aftrekbaar|aftrekpost|bijtelling|kor|kleineondernemersregeling|zelfstandigenaftrek|startersaftrek|kia|investeringsaftrek|youngtimer|aangifte|belastingdienst|auto van de zaak)/i,
  },
  {
    hub: "financien",
    words:
      /(hypotheek|financiering|uurtarief|inkomen|factuur|factureren|boekhouding|administratie|pensioen|jaarruimte|broodfonds|schenkkring|omzet|sparen|krediet|geld)/i,
  },
  { hub: "ondernemen", words: /(verzeker|aov|cyber|aansprakelijk|zorgverzekering)/i },
];

// Hub-/dienstpagina's van de oude site: die bestaan al als route, niet importeren.
const HUB_SLUGS = new Set([
  "kennisbank","ondernemen","financien","belastingen","verzekeringen","wet-en-regelgeving",
  "movir","wijzijnaov","aov-via-centraalbeheer","sharepeople","brightpensioen",
  "zzp-zorgverzekering","zzp-pensioen","arbeidsongeschiktheidsverzekering-aov-zzp",
  "mentale-gezondheidstest-mirro","pre-employment-screening-otentica",
  "beroeps-en-bedrijfs-aansprakelijkheidsverzekering-zzp-avb-bav","zzp-administratie-en-boekhouding",
]);

const NIET_ARTIKEL =
  /(bedankt|dank|zoekresultaten|^test|test-\d|-test-|home|homepage|contact|privacy|cookie|algemene-voorwaarden|disclaimer|klacht|offerte|aanmeld|inloggen|inschrijven-nieuwsbrief|vacature|sitemap|over-ons|partners|team|demo|voorbeeld|checkout|winkel|shop|mijn-account)/i;

function slugFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  return parts[parts.length - 1].toLowerCase();
}

function makeRewriter(importSlugs: Set<string>) {
  return (href: string): string => {
    let path: string | null = null;
    if (href.startsWith("/")) path = href;
    else {
      try {
        const u = new URL(href);
        if (u.hostname.replace(/^www\./, "") === "zpzaken.nl") path = u.pathname;
      } catch {
        return href;
      }
    }
    if (!path) return href;
    const slug = slugFromPath(path);
    if (!slug) return "/";
    if (importSlugs.has(slug)) return `/kennisbank/${slug}`;
    const legacy = legacyRedirectMap[slug];
    if (legacy) return legacy;
    return href;
  };
}

// Handmatige indeling door de opdrachtgever voor slugs waar de automatische
// regels geen uitsluitsel geven. Deze indeling gaat vóór de fallback.
const HANDMATIGE_CATEGORIE: Record<string, string> = {
  "hoe-zit-het-met-reiskosten-als-zzp-er": "belastingen",
  "zzp-of-eenmanszaak": "ondernemen",
  "inschrijven-bij-de-kamer-van-koophandel": "ondernemen",
  eherkenning: "ondernemen",
  ondernemingsplan: "ondernemen",
};

function guessCategory(slug: string, title: string, keyword: string) {
  const handmatig = HANDMATIGE_CATEGORIE[slug];
  if (handmatig) {
    return { ...HUB_CATEGORY[handmatig], onzeker: false, handmatig: true };
  }
  const haystack = `${slug.replace(/-/g, " ")} ${title} ${keyword}`.toLowerCase();
  for (const r of RULES) {
    if (r.words.test(haystack)) {
      return { ...HUB_CATEGORY[r.hub], onzeker: false, handmatig: false };
    }
  }
  return { ...HUB_CATEGORY.ondernemen, onzeker: true, handmatig: false };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { "user-agent": "ZPZaken-Import/1.0", accept: "application/json" } });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return { data: await res.json(), total: Number(res.headers.get("x-wp-total") || 0) };
}

interface SourceItem {
  slug: string;
  title: string;
  html: string;
  excerpt: string;
  date: string | null;
  image: string | null;
  seoTitle: string;
  seoDescription: string;
  keyword: string;
  status: string;
}

function mapRestItem(p: any): SourceItem {
  const y = p?.yoast_head_json ?? {};
  const embedded = p?._embedded?.["wp:featuredmedia"]?.[0];
  const image = embedded?.source_url || y?.og_image?.[0]?.url || null;
  return {
    slug: String(p?.slug ?? "").toLowerCase(),
    title: stripHtml(p?.title?.rendered ?? ""),
    html: String(p?.content?.rendered ?? ""),
    excerpt: stripHtml(p?.excerpt?.rendered ?? ""),
    date: p?.date_gmt ? `${p.date_gmt}Z` : (p?.date ?? null),
    image,
    seoTitle: typeof y?.title === "string" ? y.title : "",
    seoDescription: typeof y?.description === "string" ? y.description : "",
    keyword: [
      ...(Array.isArray(p?.categories_names) ? p.categories_names : []),
      ...(p?._embedded?.["wp:term"]?.flat?.() ?? []).map((t: any) => t?.name).filter(Boolean),
      y?.schema?.["@graph"]?.[0]?.name ?? "",
    ].join(" "),
    status: String(p?.status ?? "publish"),
  };
}

async function collectViaRest(): Promise<{ items: SourceItem[]; route: string; notes: string[] }> {
  const notes: string[] = [];
  const items: SourceItem[] = [];
  for (const type of ["posts", "pages"]) {
    for (let page = 1; page <= 10; page++) {
      let batch: any;
      try {
        batch = await fetchJson(`${SOURCE}/wp-json/wp/v2/${type}?per_page=100&page=${page}&status=publish&_embed`);
      } catch (e) {
        notes.push(`${type} pagina ${page}: ${(e as Error).message}`);
        break;
      }
      const list = Array.isArray(batch.data) ? batch.data : [];
      if (!list.length) break;
      items.push(...list.map(mapRestItem));
      if (list.length < 100) break;
    }
  }
  return { items, route: "wp-rest-api", notes };
}

async function collectViaHtml(slugs: string[]): Promise<{ items: SourceItem[]; route: string; notes: string[] }> {
  const notes: string[] = [];
  const items: SourceItem[] = [];
  for (const slug of slugs) {
    try {
      const res = await fetch(`${SOURCE}/${slug}/`, { headers: { "user-agent": "ZPZaken-Import/1.0" } });
      if (!res.ok) {
        notes.push(`${slug}: http_${res.status}`);
        continue;
      }
      const html = await res.text();
      const main =
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
        html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:article|main)>/i)?.[1] ??
        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
        "";
      if (!main) {
        notes.push(`${slug}: geen hoofdinhoud gevonden in HTML`);
        continue;
      }
      const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "";
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? "";
      const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i)?.[1] ?? null;
      const published = html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]*)"/i)?.[1] ?? null;
      items.push({
        slug,
        title: title || stripHtml(ogTitle),
        html: main,
        excerpt: stripHtml(desc),
        date: published,
        image: ogImage,
        seoTitle: stripHtml(ogTitle),
        seoDescription: stripHtml(desc),
        keyword: "",
        status: "publish",
      });
    } catch (e) {
      notes.push(`${slug}: ${(e as Error).message}`);
    }
  }
  return { items, route: "html-fallback", notes };
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

    // Servicepad voor de eenmalige migratie: een sterk geheim token uit
    // WP_IMPORT_TOKEN. Alleen bruikbaar met exacte match; anders normale
    // gebruikerscontrole met teamrol.
    const serviceToken = Deno.env.get("WP_IMPORT_TOKEN") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const viaServiceToken = serviceToken.length >= 32 && bearer === serviceToken;

    if (!viaServiceToken) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: "unauthorized" }, 401);

      const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: user.id });
      if (!isTeam) return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "import" ? "import" : "dryrun";
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(0, Math.min(200, Number(body.limit))) : 0;
    const slugFilter: string[] = Array.isArray(body?.slugs)
      ? body.slugs.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];

    // Route bepalen: REST API of HTML-fallback.
    let restReachable = true;
    try {
      const probe = await fetch(`${SOURCE}/wp-json`, { headers: { "user-agent": "ZPZaken-Import/1.0" } });
      restReachable = probe.ok;
    } catch {
      restReachable = false;
    }

    const collected = restReachable
      ? await collectViaRest()
      : await collectViaHtml(slugFilter.length ? slugFilter : PRIORITEIT);
    const notes = [...collected.notes];

    let items = collected.items.filter((i) => i.slug && i.status === "publish");
    // dedupliceer op slug (posts hebben voorrang op pages)
    const bySlug = new Map<string, SourceItem>();
    for (const i of items) if (!bySlug.has(i.slug)) bySlug.set(i.slug, i);
    items = [...bySlug.values()];
    const gevondenInBron = items.length;

    if (slugFilter.length) items = items.filter((i) => slugFilter.includes(i.slug));

    // Prioriteit eerst, dan de rest.
    items.sort((a, b) => {
      const pa = PRIORITEIT.indexOf(a.slug);
      const pb = PRIORITEIT.indexOf(b.slug);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
      return a.slug.localeCompare(b.slug);
    });

    const { data: existingRows } = await admin.from("articles").select("slug");
    const existing = new Set((existingRows ?? []).map((r: any) => String(r.slug).toLowerCase()));

    const kandidaatSlugs = new Set(items.map((i) => i.slug));
    const rewrite = makeRewriter(kandidaatSlugs);

    const rapport: any[] = [];
    let verwerkt = 0;
    let nieuw = 0;
    let bestaatAl = 0;
    let overgeslagen = 0;
    let geimporteerd = 0;
    const afbeeldingenTotaal = new Set<string>();

    for (const item of items) {
      if (limit && verwerkt >= limit) break;
      verwerkt++;
      const prioriteit = PRIORITEIT.includes(item.slug);
      const { markdown, images, wordCount } = htmlToMarkdown(item.html, rewrite);
      images.forEach((i) => afbeeldingenTotaal.add(i));
      const cat = guessCategory(item.slug, item.title, item.keyword);

      const row: any = {
        slug: item.slug,
        titel: item.title,
        woorden: wordCount,
        bestaat_al: existing.has(item.slug),
        categorie: cat.label,
        categorie_hub: cat.hub,
        categorie_onzeker: cat.onzeker,
        categorie_handmatig: cat.handmatig === true,
        prioriteit,
        afbeeldingen: images,
        aantal_afbeeldingen: images.length,
        published_at: item.date,
        seo_title: item.seoTitle || null,
        seo_description: item.seoDescription || null,
        image_url: item.image,
        status: "nieuw",
      };

      if (row.bestaat_al) {
        row.status = "overgeslagen";
        row.reden = "slug bestaat al in articles";
        bestaatAl++;
      } else if (!prioriteit && (HUB_SLUGS.has(item.slug) || NIET_ARTIKEL.test(item.slug) || wordCount < 150)) {
        row.status = "overgeslagen";
        row.reden = HUB_SLUGS.has(item.slug)
          ? "hub-/dienstpagina, bestaat al als route"
          : wordCount < 150
            ? `te weinig inhoud (${wordCount} woorden)`
            : "lijkt geen kennisbankartikel";
        overgeslagen++;
      } else if (!markdown) {
        row.status = "overgeslagen";
        row.reden = "geen content geëxtraheerd";
        overgeslagen++;
      } else {
        nieuw++;
      }

      if (mode === "import" && row.status === "nieuw") {
        const { error } = await admin.from("articles").insert({
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt ? item.excerpt.slice(0, 400) : null,
          content: markdown,
          category: cat.label,
          image_url: item.image,
          published_at: item.date,
          is_published: false,
          seo_title: item.seoTitle || null,
          seo_description: item.seoDescription || null,
          source_url: `${SOURCE}/${item.slug}/`,
          source_name: "zpzaken.nl (WordPress)",
          author_name: "ZP Zaken",
          generated_by_ai: false,
        });
        if (error) {
          row.status = "fout";
          row.reden = error.message;
          nieuw--;
        } else {
          row.status = "geimporteerd";
          geimporteerd++;
          nieuw--;
          existing.add(item.slug);
        }
      }

      rapport.push(row);
    }

    const bronSlugs = new Set(collected.items.map((i) => i.slug));
    const prioriteitOntbreekt = PRIORITEIT.filter((s) => !bronSlugs.has(s));

    if (mode === "import" && geimporteerd > 0) {
      try {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        await admin.from("activiteiten_log").insert({
          actie_type: "wp_import",
          omschrijving: `WordPress-import uitgevoerd: ${geimporteerd} artikelen als concept toegevoegd (route ${collected.route})`,
          uitgevoerd_door: user.id,
          uitgevoerd_door_naam: (profile as any)?.full_name || user.email || "onbekend",
        });
      } catch { /* logging mag flow niet blokkeren */ }
    }

    return json({
      success: true,
      mode,
      route: collected.route,
      samenvatting: {
        gevonden_in_bron: gevondenInBron,
        verwerkt,
        bestaat_al: bestaatAl,
        nieuw,
        overgeslagen,
        geimporteerd,
        prioriteit_ontbreekt_in_bron: prioriteitOntbreekt,
        afbeeldingen_totaal: afbeeldingenTotaal.size,
      },
      afbeeldingen: [...afbeeldingenTotaal],
      opmerkingen: notes,
      rapport,
    });
  } catch (e) {
    return json({ error: "internal_error", detail: (e as Error).message }, 500);
  }
});
