// Publieke sitemap: statische pagina's + alle gepubliceerde artikelen live uit de db.
// verify_jwt = false (crawlers moeten er ongehinderd bij kunnen).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const HOST = "https://zpzaken.nl";

const STATIC_URLS: Array<{ path: string; changefreq?: string; priority?: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/diensten", changefreq: "monthly", priority: "0.9" },
  { path: "/verzekeringen", changefreq: "monthly", priority: "0.9" },
  { path: "/aov", changefreq: "monthly", priority: "0.8" },
  { path: "/pensioen", changefreq: "monthly", priority: "0.8" },
  { path: "/zorgverzekering", changefreq: "monthly", priority: "0.8" },
  { path: "/mentale-gezondheid", changefreq: "monthly", priority: "0.7" },
  { path: "/screening", changefreq: "monthly", priority: "0.8" },
  { path: "/collectieve-inkoop", changefreq: "monthly", priority: "0.6" },
  { path: "/zzp-verzekering-ict", changefreq: "monthly", priority: "0.8" },
  { path: "/zzp-verzekering-zorg", changefreq: "monthly", priority: "0.8" },
  { path: "/zzp-verzekering-bouw", changefreq: "monthly", priority: "0.8" },
  { path: "/offerte", changefreq: "monthly", priority: "0.8" },
  { path: "/waarom-zp-zaken", changefreq: "monthly", priority: "0.8" },
  { path: "/voor-wie", changefreq: "monthly", priority: "0.7" },
  { path: "/zo-werken-wij", changefreq: "monthly", priority: "0.7" },
  { path: "/kennisbank", changefreq: "weekly", priority: "0.8" },
  { path: "/kennisbank/wet-en-regelgeving", changefreq: "monthly", priority: "0.7" },
  { path: "/kennisbank/ondernemen", changefreq: "monthly", priority: "0.7" },
  { path: "/kennisbank/belastingen", changefreq: "monthly", priority: "0.7" },
  { path: "/kennisbank/financien", changefreq: "monthly", priority: "0.7" },
  { path: "/over-ons", changefreq: "monthly", priority: "0.7" },
  { path: "/partners", changefreq: "monthly", priority: "0.6" },
  { path: "/historie", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/documenten", changefreq: "monthly", priority: "0.5" },
  { path: "/documenten/slotverklaring", changefreq: "yearly", priority: "0.4" },
  { path: "/documenten/dienstverleningsdocument", changefreq: "yearly", priority: "0.4" },
  { path: "/documenten/gedragscode", changefreq: "yearly", priority: "0.4" },
  { path: "/algemene-voorwaarden", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
  { path: "/social-media", changefreq: "weekly", priority: "0.4" },
];

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: articles } = await admin
      .from("articles")
      .select("slug,published_at,updated_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    for (const u of STATIC_URLS) {
      parts.push(
        `  <url><loc>${escapeXml(HOST + u.path)}</loc>` +
          (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
          (u.priority ? `<priority>${u.priority}</priority>` : "") +
          `</url>`,
      );
    }

    for (const a of articles ?? []) {
      const slug = (a as any).slug as string;
      if (!slug) continue;
      const lastmodRaw = ((a as any).published_at ?? (a as any).updated_at) as string | null;
      const lastmod = lastmodRaw ? String(lastmodRaw).slice(0, 10) : "";
      parts.push(
        `  <url><loc>${escapeXml(`${HOST}/kennisbank/${slug}`)}</loc>` +
          (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
          `<changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      );
    }

    parts.push("</urlset>");

    return new Response(parts.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (_e) {
    return new Response("<?xml version=\"1.0\"?><error/>", { status: 500, headers: { "Content-Type": "application/xml" } });
  }
});
