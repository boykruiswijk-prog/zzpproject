import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Monitor, Palette, Wrench, Stethoscope, Briefcase, Rocket, Users, Shield, CheckCircle } from "lucide-react";

const audiences = [
  {
    icon: Rocket,
    title: "Starters",
    description: "Net begonnen als zzp'er? Wij helpen je op weg met de basisverzekeringen die je nodig hebt om veilig te ondernemen.",
    needs: [
      "Beroeps- of bedrijfsaansprakelijkheid",
      "Basisadvies over arbeidsongeschiktheid",
      "Uitleg over verplichte verzekeringen",
    ],
  },
  {
    icon: Briefcase,
    title: "Ervaren zzp'ers",
    description: "Al jaren zelfstandig? Check of je verzekeringen nog actueel zijn en optimaliseer je dekking en premie.",
    needs: [
      "Review van huidige verzekeringen",
      "Optimalisatie van dekking en premie",
      "Uitbreiding naar aanvullende verzekeringen",
    ],
  },
  {
    icon: Monitor,
    title: "ICT & Tech",
    description: "Developers, IT-consultants en tech-specialisten. Opdrachtgevers eisen vaak een beroepsaansprakelijkheidsverzekering.",
    needs: [
      "Beroepsaansprakelijkheid (vaak verplicht)",
      "Cyber- en dataverzekeringen",
      "Hoge verzekerde bedragen mogelijk",
    ],
  },
  {
    icon: Palette,
    title: "Creatieve sector",
    description: "Designers, marketeers, fotografen en andere creatieven. Bescherm je werk en je klantrelaties.",
    needs: [
      "Beroepsaansprakelijkheid",
      "Apparatuur- en materiaaldekking",
      "Intellectueel eigendom bescherming",
    ],
  },
  {
    icon: Wrench,
    title: "Bouw & Techniek",
    description: "Aannemers, installateurs en vakmensen. Werk op locatie brengt specifieke risico's met zich mee.",
    needs: [
      "Bedrijfsaansprakelijkheid (essentieel)",
      "Constructie-all-risk dekking",
      "Gereedschaps- en materiaaldekking",
    ],
  },
  {
    icon: Stethoscope,
    title: "Zorg & Welzijn",
    description: "Zzp'ers in de zorg, coaches en therapeuten. Werk met mensen vraagt om specifieke dekking.",
    needs: [
      "Beroepsaansprakelijkheid (vaak verplicht)",
      "Tuchtrechtdekking",
      "Verzuim- en arbeidsongeschiktheid",
    ],
  },
];

// Structured data for audiences
const audienceSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Voor wie is ZP Zaken?",
  "description": "ZP Zaken helpt zzp'ers en freelancers in elke fase en elk vakgebied met verzekeringen en zakelijk advies.",
  "provider": {
    "@type": "Organization",
    "name": "ZP Zaken"
  },
  "audience": audiences.map(a => ({
    "@type": "Audience",
    "audienceType": a.title,
    "description": a.description
  }))
};

export default function VoorWie() {
  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(audienceSchema) }}
      />

      <PageHero
        title={<>Voor wie is <span className="text-accent">ZP Zaken</span>?</>}
        subtitle="Of je nu net start of al jaren zelfstandig bent — wij helpen zzp'ers en freelancers in elke fase en elk vakgebied."
        badge={{
          icon: <Users className="h-4 w-4" />,
          text: "Voor alle zzp'ers"
        }}
      />

      {/* Audiences as Shield Cards */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="bg-card rounded-2xl p-8 shadow-card border border-border/50 hover:shadow-lg hover:border-accent/30 transition-all duration-300"
                itemScope
                itemType="https://schema.org/Audience"
              >
                {/* Header Shield */}
                <div className="inline-flex items-center gap-3 bg-accent/10 border border-accent/20 px-4 py-2 rounded-xl mb-6">
                  <audience.icon className="h-5 w-5 text-accent" />
                  <h3 className="text-lg font-semibold" itemProp="audienceType">{audience.title}</h3>
                </div>
                
                <p className="text-muted-foreground mb-6" itemProp="description">{audience.description}</p>
                
                {/* Needs as Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {audience.needs.map((need) => (
                    <span
                      key={need}
                      className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-3 py-1.5 rounded-lg text-sm"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />
                      {need}
                    </span>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/contact">
                    Vraag advies aan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Jouw beroep niet genoemd?</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {["Alle sectoren", "Persoonlijk advies", "Maatwerk oplossingen"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-full text-sm"
                >
                  <Shield className="h-4 w-4 text-accent" />
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Geen zorgen! We helpen zzp'ers in alle sectoren. Neem contact op 
              en we kijken samen naar jouw specifieke situatie.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Gratis adviesgesprek
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
