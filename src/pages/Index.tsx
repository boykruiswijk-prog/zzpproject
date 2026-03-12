import { LocalizedLink } from "@/components/LocalizedLink";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, ThumbsUp, CheckCircle } from "lucide-react";

export default function Index() {
  return (
    <Layout>
      <SEOHead
        title="ZP Zaken | BAV & AVB Verzekering voor ZZP'ers | Binnen 24 uur"
        description="Sluit binnen 24 uur je beroeps- of bedrijfsaansprakelijkheidsverzekering af. ZP Zaken is onafhankelijk verzekeringsadviseur voor alle ZZP'ers in Nederland."
        canonical="/"
        schema={{
          "@context": "https://schema.org",
          "@type": "InsuranceAgency",
          name: "ZP Zaken",
          url: "https://zpzaken.nl",
          description: "Onafhankelijk verzekeringsadvies voor ZZP'ers. BAV en AVB binnen 24 uur.",
          address: { "@type": "PostalAddress", addressCountry: "NL" },
          areaServed: "NL",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "ZZP Verzekeringen",
            itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Beroepsaansprakelijkheidsverzekering ZZP" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Bedrijfsaansprakelijkheidsverzekering ZZP" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "AOV ZZP" } },
            ],
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            reviewCount: "47",
          },
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">Zorgeloos ZZPen begint met de juiste verzekering</h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Binnen 24 uur je beroeps- of bedrijfsaansprakelijkheidsverzekering geregeld. Onafhankelijk advies, scherpe premies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/contact">
                  Vraag gratis advies aan
                  <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <Button variant="outline" size="lg" asChild className="border-white/30 text-white hover:bg-white/10">
                <LocalizedLink to="/verzekeringen">
                  Bekijk verzekeringen
                </LocalizedLink>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* USPs */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Clock className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Binnen 24 uur verzekerd</h3>
              <p className="text-muted-foreground">
                Geen lange wachttijden. Na goedkeuring ontvang je dezelfde dag je polis digitaal in je mailbox.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Onafhankelijk advies</h3>
              <p className="text-muted-foreground">
                Wij zijn niet gebonden aan één verzekeraar. We vergelijken en adviseren wat het beste bij jouw situatie past.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <ThumbsUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Persoonlijk contact</h3>
              <p className="text-muted-foreground">
                Geen callcenter. Je spreekt direct met een adviseur die je situatie kent en begrijpt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verzekeringen overzicht */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="mb-4">Wat regelen wij voor je?</h2>
            <p className="text-lg text-muted-foreground">
              Van aansprakelijkheid tot arbeidsongeschiktheid — alles voor de ZZP'er op één plek.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Beroepsaansprakelijkheidsverzekering (BAV)",
                description: "Bescherming bij fouten in je dienstverlening of advies. Verplicht in veel sectoren.",
                href: "/verzekeringen",
              },
              {
                title: "Bedrijfsaansprakelijkheidsverzekering (AVB)",
                description: "Dekking voor schade aan personen of eigendommen tijdens je werk.",
                href: "/verzekeringen",
              },
              {
                title: "Arbeidsongeschiktheidsverzekering (AOV)",
                description: "Financiële zekerheid als je door ziekte of letsel niet kunt werken.",
                href: "/verzekeringen",
              },
              {
                title: "Collectieve zorgverzekering",
                description: "Voordelige zorgpakketten speciaal samengesteld voor ZZP'ers.",
                href: "/verzekeringen",
              },
            ].map((item) => (
              <LocalizedLink
                key={item.title}
                to={item.href}
                className="bg-card rounded-2xl p-8 shadow-card border border-border/50 hover:shadow-card-hover hover:border-accent/30 transition-all duration-300 group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                  <h3 className="text-lg font-semibold group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                </div>
                <p className="text-muted-foreground ml-8">{item.description}</p>
              </LocalizedLink>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Klaar om je goed te verzekeren?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Vraag een gratis en vrijblijvend adviesgesprek aan. Wij regelen de rest binnen 24 uur.
            </p>
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/contact">
                Start gratis adviesgesprek
                <ArrowRight className="h-5 w-5" />
              </LocalizedLink>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}