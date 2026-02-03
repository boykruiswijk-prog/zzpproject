import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react";

const articles = [
  {
    slug: "zelfstandigenwet-voor-zzp-ers",
    title: "De Zelfstandigenwet: duidelijkheid voor zzp'ers?",
    excerpt: "Er is veel onrust onder zzp'ers vanwege de wetgeving rondom schijnzelfstandigheid. In 2025 geldt de wet DBA, maar deze zou vervangen worden door de wet VBAR. In april 2025 is er echter een nieuw initiatiefwetsvoorstel ingediend, dat de Zelfstandigenwet wordt genoemd.",
    category: "Wetgeving",
    date: "15 juli 2025",
    readTime: "5 min",
  },
  {
    slug: "nieuwe-regels-zzp-2025",
    title: "Nieuwe regels zzp 2025",
    excerpt: "In 2025 zijn er diverse veranderingen rondom regelgeving, waar je als zzp'er mee te maken (kunt) krijgen. Van de wet DBA tot de KOR-wijzigingen - een overzicht van alle belangrijke veranderingen.",
    category: "Regelgeving",
    date: "10 januari 2025",
    readTime: "4 min",
  },
  {
    slug: "vbar-wet-verduidelijking-arbeidsrelaties",
    title: "VBAR: Wet verduidelijking beoordeling arbeidsrelaties en rechtsvermoeden",
    excerpt: "De wet VBAR is de opvolger van de veelbesproken wet op dit moment: DBA. Waarom moet er een nieuwe wet komen en wat betekent dit voor jou als zzp'er?",
    category: "Wetgeving",
    date: "5 december 2024",
    readTime: "6 min",
  },
  {
    slug: "wijziging-kleineondernemersregeling-kor-2025",
    title: "Wijziging Kleineondernemersregeling (KOR) in 2025",
    excerpt: "De kleineondernemersregeling, kortweg KOR, zal vanaf 1 januari 2025 veranderen. Wat betekent dit voor jou en moet je actie ondernemen?",
    category: "Fiscaal",
    date: "20 november 2024",
    readTime: "3 min",
  },
  {
    slug: "wet-dba-alles-wat-je-moet-weten",
    title: "Alles wat je moet weten over de wet DBA",
    excerpt: "De wet DBA is niet nieuw, maar vanaf 1 januari 2025 zal er strenger gehandhaafd gaan worden. Wat betekent dit voor jou als zelfstandige of opdrachtgever?",
    category: "Wetgeving",
    date: "1 november 2024",
    readTime: "7 min",
  },
  {
    slug: "aov-arbeidsongeschiktheidsverzekering",
    title: "AOV voor zzp'ers: alles wat je moet weten",
    excerpt: "Als zzp'er bouw je geen WIA op. Een arbeidsongeschiktheidsverzekering kan uitkomst bieden. Maar waar moet je op letten?",
    category: "Verzekeringen",
    date: "15 oktober 2024",
    readTime: "5 min",
  },
  {
    slug: "beroepsaansprakelijkheid-vs-bedrijfsaansprakelijkheid",
    title: "Beroepsaansprakelijkheid vs bedrijfsaansprakelijkheid",
    excerpt: "Wat is het verschil tussen deze twee verzekeringen en welke heb je nodig als zzp'er? Een heldere uitleg.",
    category: "Verzekeringen",
    date: "1 oktober 2024",
    readTime: "4 min",
  },
  {
    slug: "verzekeringen-belastingdienst-aftrekbaar",
    title: "Verzekeringen en de Belastingdienst",
    excerpt: "Welke premies zijn aftrekbaar en hoe geef je dit op in je aangifte? Tips voor een slimme fiscale aanpak.",
    category: "Fiscaal",
    date: "15 september 2024",
    readTime: "4 min",
  },
];

const categories = ["Alle", "Wetgeving", "Regelgeving", "Verzekeringen", "Fiscaal"];

export default function Kennisbank() {
  return (
    <Layout>
      <PageHero
        title="De nieuwste kennis artikelen van ZP Zaken"
        subtitle="Blijf op de hoogte van de laatste ontwikkelingen rondom wetgeving, verzekeringen en alles wat je als zzp'er moet weten. Praktische informatie, helder uitgelegd."
        badge={{
          icon: <BookOpen className="h-4 w-4" />,
          text: "Kennisbank"
        }}
      />

      {/* Category Filter */}
      <section className="bg-background border-b border-border">
        <div className="container-wide py-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === "Alle"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <article
                key={article.slug}
                className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50 hover:shadow-card-hover hover:border-accent/30 transition-all duration-300 group cursor-pointer flex flex-col"
              >
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm font-medium rounded-full">
                      {article.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-muted-foreground mb-4 flex-1 line-clamp-3">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {article.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {article.readTime}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors">
                    Lees artikel
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Blijf op de hoogte</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Ontvang de nieuwste artikelen en updates direct in je mailbox. 
              Geen spam, alleen relevante informatie voor zzp'ers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Je e-mailadres"
                className="flex-1 px-4 py-3 rounded-lg border-0 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
              />
              <Button variant="accent" size="lg">
                Aanmelden
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Persoonlijk advies nodig?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Onze adviseurs helpen je graag met al je vragen over verzekeringen, 
              wetgeving en ondernemerschap.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek plannen
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
