// Genereert llms.txt en llms-full.txt tijdens de prerender. Alleen feiten die
// al op de site staan: bedrijfsgegevens uit site.ts, premies en dekkingen uit
// bavPakketten.ts, pagina's uit seoRoutes.ts en vragen uit faqItems.ts.
import { SITE_CONFIG } from "../src/config/site";
import { bavPakketten } from "../src/data/bavPakketten";
import { faqItems } from "../src/data/faqItems";
import type { SeoRoute } from "../src/config/seoRoutes";

interface LlmsArticle {
  slug: string;
  title: string;
  excerpt: string | null;
  seo_description: string | null;
}

const eur = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Geldbelangrijke pagina's eerst; overige publieke routes daarna. */
const KERN = [
  "/", "/verzekeringen", "/bav-zzp-vergelijken", "/offerte", "/waarom-zp-zaken", "/aov", "/pensioen", "/zorgverzekering",
  "/zzp-verzekering-ict", "/zzp-verzekering-zorg", "/zzp-verzekering-bouw",
  "/zzp-verzekering-consultant", "/zzp-verzekering-interim-manager", "/zzp-verzekering-finance", "/zzp-verzekering-hr", "/starters", "/zzp-verzekering-marketing", "/zzp-verzekering-coach", "/diensten",
  "/screening", "/faq", "/contact", "/over-ons",
];

function intro(): string[] {
  const r = SITE_CONFIG.registrations;
  const prijzen = bavPakketten.map((p) => `${p.name}: ${p.prijsLabel}`).join("; ");
  return [
    `# ${SITE_CONFIG.name}`,
    "",
    `> ${SITE_CONFIG.legalName} is een AFM-geregistreerde verzekeringsadviseur voor zzp'ers in Nederland (AFM ${r.afm}, KvK ${r.kvk}, Kifid ${r.kifid}). ZP Zaken biedt de BAV + AVB in één polis voor zzp'ers, verzekerd bij Hiscox.`,
    "",
    `- Premies: ${prijzen}. Premie inclusief kosten en assurantiebelasting.`,
    "- Dagelijks opzegbaar, geen eigen risico.",
    "- Binnen 24 uur verzekerd, met certificaat als bewijs voor je opdrachtgever.",
    `- Contact: ${SITE_CONFIG.phoneDisplay}, ${SITE_CONFIG.email}, ${SITE_CONFIG.address.streetAddress}, ${SITE_CONFIG.address.postalCode} ${SITE_CONFIG.address.addressLocality}.`,
    "",
  ];
}

export function buildLlmsTxt(routes: SeoRoute[], articles: LlmsArticle[]): string {
  const byPath = new Map(routes.map((r) => [r.path, r]));
  const kern = KERN.map((p) => byPath.get(p)).filter(Boolean) as SeoRoute[];
  const rest = routes.filter((r) => !KERN.includes(r.path));
  const link = (r: SeoRoute) =>
    `- [${oneLine(r.h1 || r.title)}](${SITE_CONFIG.url}${r.path === "/" ? "/" : r.path}): ${oneLine(r.description)}`;
  return [
    ...intro(),
    "## Belangrijkste pagina's",
    "",
    ...kern.map(link),
    "",
    "## Kennisbank",
    "",
    ...articles.slice(0, 25).map(
      (a) =>
        `- [${oneLine(a.title)}](${SITE_CONFIG.url}/kennisbank/${a.slug}): ${oneLine(a.seo_description || a.excerpt || a.title).slice(0, 200)}`,
    ),
    "",
    "## Optional",
    "",
    ...rest.map(link),
    `- [Uitgebreide feiten](${SITE_CONFIG.url}/llms-full.txt): productfeiten en veelgestelde vragen.`,
    "",
  ].join("\n");
}

export function buildLlmsFullTxt(routes: SeoRoute[]): string {
  const lines = [...intro(), "## Producten", ""];
  for (const p of bavPakketten) {
    const d = p.dekkingen;
    lines.push(
      `### ${p.name}`,
      "",
      `- Premie: ${p.prijsLabel} (inclusief kosten en assurantiebelasting).`,
      `- Beroepsaansprakelijkheid (BAV): ${eur(d.bav.perGebeurtenis)} per aanspraak, ${eur(d.bav.perJaar)} per jaar.`,
      `- Bedrijfsaansprakelijkheid (AVB): ${eur(d.avb.perGebeurtenis)} per gebeurtenis, ${eur(d.avb.perJaar)} per jaar.`,
      ...(d.cyber ? [`- Cyber: ${eur(d.cyber.perSchade)} per schade, ${eur(d.cyber.perJaar)} per jaar.`] : []),
      ...p.usps.map((u) => `- ${u}.`),
      "- Voor: zzp'ers en zelfstandig professionals in Nederland.",
      `- Meer informatie: ${SITE_CONFIG.url}/verzekeringen`,
      "",
    );
  }
  lines.push("## Pagina's", "");
  for (const r of routes) {
    lines.push(`### ${oneLine(r.h1 || r.title)}`, "", `URL: ${SITE_CONFIG.url}${r.path === "/" ? "/" : r.path}`, "", oneLine(r.intro || r.description), "");
  }
  lines.push("## Veelgestelde vragen", "");
  for (const cat of faqItems as unknown as Array<{ category?: string; questions: Array<{ question: string; answer: string }> }>) {
    if (cat.category) lines.push(`### ${cat.category}`, "");
    for (const q of cat.questions) lines.push(`**${oneLine(q.question)}**`, "", oneLine(q.answer), "");
  }
  return lines.join("\n");
}
