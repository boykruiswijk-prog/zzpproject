import { seoRoute } from "@/config/seoRoutes";
import { SEOHead } from "@/components/SEOHead";
import { faqSchema } from "@/lib/schema";
import { faqItems } from "@/data/faqItems";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { HelpCircle } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";
import officeFlowers from "@/assets/office-flowers.jpg";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SEO = seoRoute("/faq");

const faqJsonLd = faqSchema(faqItems.flatMap((c) => c.questions));

export default function FAQ() {
  const { t } = useTranslation();

  return (
    <Layout>
      <SEOHead
        title={SEO.title}
        description={SEO.description}
      >
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </SEOHead>

      <PageHero
        title={t("faq.title")}
        subtitle={t("faq.subtitle")}
        badge={{ icon: <HelpCircle className="h-4 w-4" />, text: t("faq.badge") }}
        backgroundImage={officeFlowers}
      />

      <section className="section-padding bg-background">
        <div className="container-wide max-w-4xl">
          {faqItems.map((category, categoryIndex) => (
            <div key={category.category} className="mb-12 last:mb-0">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">{categoryIndex + 1}</span>
                {category.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-3">
                {category.questions.map((item, index) => (
                  <AccordionItem key={index} value={`${category.category}-${index}`} className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-md transition-shadow">
                    <AccordionTrigger className="text-left hover:no-underline py-5">
                      <span className="font-medium pr-4">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      <section className="section-padding bg-secondary">
        <div className="container-wide text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">{t("faq.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("faq.ctaSubtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">{t("faq.ctaButton")}</LocalizedLink>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="tel:0204573077">{t("faq.ctaPhone")}</a>
            </Button>
          </div>

          {/* Internal linking */}
          <div className="flex flex-wrap justify-center gap-3 pt-6 border-t border-border">
            <LocalizedLink to="/verzekeringen" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.viewInsurance")}
            </LocalizedLink>
            <LocalizedLink to="/kennisbank" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.knowledgeBase")}
            </LocalizedLink>
            <LocalizedLink to="/diensten" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {t("faqLinks.allServices")}
            </LocalizedLink>
          </div>
        </div>
      </section>
    </Layout>
  );
}
