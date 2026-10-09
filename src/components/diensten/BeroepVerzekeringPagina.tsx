import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { seoRoute } from "@/config/seoRoutes";
import { ServicePageTemplate } from "@/components/diensten/ServicePageTemplate";
import { faqSchema } from "@/lib/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BAVApplicationModule } from "@/components/home/BAVApplicationModule";
import { LeesMeer } from "@/components/kennisbank/LeesMeer";
import { LocalizedLink } from "@/components/LocalizedLink";
import { ArrowRight } from "lucide-react";
import { bavPakketten, formatMiljoenKort, getPakket } from "@/data/bavPakketten";

import serviceVerzekeringen from "@/assets/service-verzekeringen.webp";
import teamMeeting from "@/assets/team-meeting.webp";
import officeCoffee from "@/assets/office-coffee.webp";

/** Bedragen uitsluitend uit bavPakketten. */
const PAKKET = bavPakketten[0];
export const BAV_DEKKING = formatMiljoenKort(PAKKET.dekkingen.bav.perGebeurtenis);
export const AVB_DEKKING = formatMiljoenKort(PAKKET.dekkingen.avb.perGebeurtenis);
export const PRIJS_MAAND = `€${getPakket("maandelijks").prijs}`;
export const PRIJS_JAAR = `€${getPakket("jaarlijks").prijs}`;

export interface Faq {
  question: string;
  answer: string;
}

interface Props {
  path: string;
  serviceName: string;
  badge: string;
  title: ReactNode;
  subtitle: string;
  sector: string;
  benefits: { icon: LucideIcon; title: string; description: string }[];
  explainers: { title: string; text: string; bullets?: string[] }[];
  faqs: Faq[];
  leesMeer: string[];
}

export function BeroepVerzekeringPagina(p: Props) {
  const SEO = seoRoute(p.path);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: p.serviceName,
        provider: { "@type": "Organization", name: "ZP Zaken", url: "https://zpzaken.nl" },
        description: SEO.description,
        areaServed: "NL",
      },
      faqSchema(p.faqs),
    ],
  };
  const images = [teamMeeting, officeCoffee];

  return (
    <ServicePageTemplate
      seoTitle={SEO.title}
      seoDescription={SEO.description}
      canonicalPath={p.path}
      heroImage={serviceVerzekeringen}
      badge={p.badge}
      title={p.title}
      subtitle={p.subtitle}
      schema={schema}
      benefits={p.benefits}
      explainers={p.explainers.map((e, i) => ({ ...e, image: images[i % images.length] }))}
      ctaTitle="Neem persoonlijk contact op"
      ctaSubtitle="Vertel ons wat je doet en voor wie. Wij regelen de juiste dekking."
      ctaButton="Neem persoonlijk contact op"
      aanvraag="direct"
    >
      <BAVApplicationModule initialSector={p.sector} />
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-6 text-center">Veelgestelde vragen</h2>
            <Accordion type="single" collapsible className="w-full">
              {p.faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <LocalizedLink
                to="/bav-zzp-vergelijken"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                BAV zzp vergelijken <ArrowRight className="h-4 w-4" />
              </LocalizedLink>
              <LocalizedLink
                to="/verzekeringen"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                Bekijk de BAV + AVB verzekering <ArrowRight className="h-4 w-4" />
              </LocalizedLink>
            </div>
          </div>
        </div>
      </section>
      <LeesMeer voorkeur={p.leesMeer} />
    </ServicePageTemplate>
  );
}
