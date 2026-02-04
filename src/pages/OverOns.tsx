import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Eye, Users, Award, Heart, Shield, CheckCircle } from "lucide-react";
import teamMember1 from "@/assets/team-member-1.jpg";
import teamMember2 from "@/assets/team-member-2.jpg";
import teamMember3 from "@/assets/team-member-3.jpg";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const values = [
  {
    icon: Target,
    title: "Onafhankelijk",
    description: "We zijn niet gebonden aan één verzekeraar. Ons advies is gebaseerd op wat het beste bij jou past, niet op commissies.",
  },
  {
    icon: Eye,
    title: "Transparant",
    description: "Geen kleine lettertjes of verborgen kosten. We leggen alles helder uit zodat je weet waar je aan toe bent.",
  },
  {
    icon: Users,
    title: "Persoonlijk",
    description: "Je spreekt met echte adviseurs die je situatie kennen. Geen callcenters of doorverwijzingen.",
  },
  {
    icon: Award,
    title: "Deskundig",
    description: "Meer dan 10 jaar ervaring in verzekeringen voor zelfstandigen. We kennen de markt en jouw uitdagingen.",
  },
];

const facts = [
  { value: "2012", label: "Opgericht" },
  { value: "2.500+", label: "Klanten" },
  { value: "13+", label: "Jaar ervaring" },
  { value: "4.9/5", label: "Beoordeling" },
];

const team = [
  {
    name: "Boy Kruiswijk",
    role: "Oprichter",
    image: teamMember1,
    description: "Ruim 13 jaar geleden bedenker van de unieke polis voor zzp'ers in Nederland. Zijn visie: iedere ondernemer goed en zorgeloos verzekerd.",
  },
  {
    name: "Roxy Taskin",
    role: "Backoffice",
    image: teamMember2,
    description: "Zorgt ervoor dat alles op de achtergrond soepel verloopt. Van administratie tot klantondersteuning.",
  },
  {
    name: "Ellen Baars",
    role: "Senior Adviseur",
    image: teamMember3,
    description: "Met jarenlange ervaring in verzekeringen helpt zij ondernemers met passend advies voor hun situatie.",
  },
];

const registrations = [
  { title: "AFM geregistreerd", description: "Wij staan geregistreerd bij de Autoriteit Financiële Markten als onafhankelijk adviseur." },
  { title: "Kifid aangesloten", description: "Bij klachten kun je terecht bij het Klachteninstituut Financiële Dienstverlening." },
  { title: "Beroepsaansprakelijkheid verzekerd", description: "Uiteraard zijn wij zelf ook verzekerd tegen beroepsfouten." },
];

// Structured data for Google
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ZP Zaken",
  "url": "https://zpzaken.nl",
  "logo": "https://zpzaken.nl/logo.png",
  "foundingDate": "2012",
  "description": "Onafhankelijk advies voor zzp'ers op het gebied van verzekeringen, administratie, juridisch advies en screening.",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "NL"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": "2500"
  },
  "sameAs": []
};

export default function OverOns() {
  return (
    <Layout>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <PageHero
        title="Over ZP Zaken"
        subtitle="Wij geloven dat zzp'ers recht hebben op eerlijk, persoonlijk advies. Geen verkooppraatjes — gewoon goed geregeld."
        badge={{
          icon: <Heart className="h-4 w-4" />,
          text: "Met passie voor ondernemers"
        }}
        backgroundImage={teamBoyCalling}
      />

      {/* Mission */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="mb-6">Onze missie</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Als zzp'er heb je genoeg aan je hoofd. Je focust op je vak, je klanten en het 
                runnen van je onderneming. Verzekeringen en zakelijke zekerheid moeten geen 
                hoofdpijndossier zijn.
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                Daarom startten we ZP Zaken: om zelfstandig ondernemers te helpen met helder, 
                onafhankelijk advies. We nemen de tijd om je situatie te begrijpen en adviseren 
                alleen wat je écht nodig hebt.
              </p>
              
              {/* Mission Shield Tags */}
              <div className="flex flex-wrap gap-2">
                {["Eerlijk advies", "Geen onnodige producten", "Begrijpelijke taal"].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-foreground px-3 py-1.5 rounded-lg text-sm"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-accent" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8 lg:p-12">
              <blockquote className="text-xl lg:text-2xl font-medium mb-6 text-foreground">
                "Zzp'ers verdienen dezelfde zekerheid als werknemers, maar dan wel op een 
                manier die past bij het ondernemersleven."
              </blockquote>
              <p className="text-muted-foreground font-medium">
                — Boy Kruiswijk, Oprichter ZP Zaken
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">Ons team</h2>
            <p className="text-lg text-muted-foreground">
              Een klein, toegewijd team dat klaarstaat om je te helpen met al je vragen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div 
                key={member.name} 
                className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50"
                itemScope
                itemType="https://schema.org/Person"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    itemProp="image"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold" itemProp="name">{member.name}</h3>
                  <span className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full text-sm font-medium my-3">
                    <Shield className="h-3.5 w-3.5" />
                    <span itemProp="jobTitle">{member.role}</span>
                  </span>
                  <p className="text-muted-foreground text-sm" itemProp="description">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values as Shield Tags */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">Waar we voor staan</h2>
            <p className="text-lg text-muted-foreground">
              Onze kernwaarden bepalen hoe we werken en hoe we met je omgaan.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {values.map((value) => (
              <div
                key={value.title}
                className="inline-flex items-center gap-3 bg-card border border-border/50 shadow-sm px-5 py-3 rounded-xl"
              >
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <value.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{value.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facts as Shield Badges */}
      <section className="section-padding text-primary-foreground relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={officeCoffee}
            alt=""
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        
        <div className="container-wide relative z-10">
          <div className="flex flex-wrap justify-center gap-6">
            {facts.map((fact) => (
              <div 
                key={fact.label} 
                className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 px-6 py-4 rounded-xl"
              >
                <Shield className="h-5 w-5 text-accent" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold">{fact.value}</p>
                  <p className="text-primary-foreground/70 text-sm">{fact.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust - Registrations as Shields */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-8 text-center">Officieel geregistreerd</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {registrations.map((reg) => (
                <div
                  key={reg.title}
                  className="inline-flex items-center gap-3 bg-accent/10 border border-accent/20 px-5 py-3 rounded-xl max-w-sm"
                  itemProp="hasCredential"
                  itemScope
                  itemType="https://schema.org/EducationalOccupationalCredential"
                >
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm" itemProp="name">{reg.title}</p>
                    <p className="text-xs text-muted-foreground" itemProp="description">{reg.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Wil je ons leren kennen?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Plan een vrijblijvend kennismakingsgesprek. We vertellen je graag 
              meer over hoe we je kunnen helpen.
            </p>
            <Button variant="accent" size="lg" asChild>
              <Link to="/contact">
                Maak kennis
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
