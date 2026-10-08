// Bouwt de kennisbasis van chatassistent Zeker uitsluitend uit bestaande sitebronnen.
// De uitkomst wordt door scripts/genereer-zeker-kennis.ts weggeschreven naar
// supabase/functions/_shared/zekerKennis.generated.ts; een test borgt dat beide gelijk zijn.
// Bewust NIET opgenomen: interne vlaggen zoals handmatige acceptatie per sector.
import { CYBER_DETAILS, CYBER_LOOPTIJD } from "../../../supabase/functions/_shared/cyber";
import { bavPakketten } from "../../data/bavPakketten";
import { faqItems } from "../../data/faqItems";
import { seoRoutes } from "../../config/seoRoutes";
import { branches, algemeneBavDocumenten, zpZakenEigenDocumenten } from "../../data/documentenLijst";
import { WIZARD_SECTOREN, verzekeringskaartVoorSector } from "../../data/sectorVerzekeringskaart";
import nl from "../../i18n/locales/nl.json";

export interface ZekerKennis {
  pakketten: {
    id: string; naam: string; prijs: number; periode: string; prijsLabel: string;
    bav: { perGebeurtenis: number; perJaar: number };
    avb: { perGebeurtenis: number; perJaar: number };
    cyber: { perSchade: number; perJaar: number } | null;
    usps: string[];
  }[];
  paginas: { path: string; title: string; intro: string }[];
  faq: { categorie: string; vraag: string; antwoord: string }[];
  sectoren: { id: string; label: string; verzekeringskaart: string | null }[];
  documenten: { titel: string; path: string }[];
  collectief: { titel: string; omschrijving: string; usps: string[] };
}

export function bouwZekerKennis(): ZekerKennis {
  const ci = (nl as unknown as Record<string, Record<string, string>>).collectieveInkoop;
  const docs = new Map<string, string>();
  for (const b of branches) for (const d of b.documenten) docs.set(d.path, `${d.titel} (${b.naam})`);
  for (const d of [...algemeneBavDocumenten, ...zpZakenEigenDocumenten]) docs.set(d.path, d.titel);
  return {
    pakketten: bavPakketten.map((p) => ({
      id: p.id, naam: p.name, prijs: p.prijs, periode: p.periode, prijsLabel: p.prijsLabel,
      bav: { ...p.dekkingen.bav }, avb: { ...p.dekkingen.avb },
      cyber: p.dekkingen.cyber ? { ...p.dekkingen.cyber } : null,
      usps: [...p.usps, ...(p.dekkingen.cyber ? [CYBER_DETAILS, CYBER_LOOPTIJD] : [])],
    })),
    paginas: seoRoutes.map((r) => ({ path: r.path, title: r.title, intro: r.intro })),
    faq: faqItems.flatMap((c) => c.questions.map((q) => ({ categorie: c.category, vraag: q.question, antwoord: q.answer }))),
    sectoren: WIZARD_SECTOREN.map((s) => ({ id: s.id, label: s.label, verzekeringskaart: verzekeringskaartVoorSector(s.id)?.path ?? null })),
    documenten: [...docs.entries()].map(([path, titel]) => ({ titel, path })),
    collectief: {
      titel: "Collectieve inkoop (/collectieve-inkoop)",
      omschrijving: [ci.heroSubtitle, `${ci.pilotStroom}: ${ci.pilotStroomDesc}`, `${ci.pilotSoftware}: ${ci.pilotSoftwareDesc}`, `${ci.pilotAiTools}: ${ci.pilotAiToolsDesc}`, `${ci.pilotTelefonie}: ${ci.pilotTelefonieDesc}`].join("\n"),
      usps: [ci.heroUsp1, ci.heroUsp2, ci.heroUsp3, ci.limitedPlaces],
    },
  };
}
