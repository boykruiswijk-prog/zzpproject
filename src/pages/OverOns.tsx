import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Eye, Users, Award, CheckCircle } from "lucide-react";

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
  { value: "2015", label: "Opgericht" },
  { value: "2.500+", label: "Klanten" },
  { value: "10+", label: "Jaar ervaring" },
  { value: "4.9/5", label: "Beoordeling" },
];

export default function OverOns() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">
              Over ZP Zaken
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Wij geloven dat zzp'ers recht hebben op eerlijk, persoonlijk advies. 
              Zonder tussenpersonen, zonder verkooppraatjes — gewoon goed geregeld.
            </p>
          </div>
        </div>
      </section>

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
              <p className="text-lg text-muted-foreground">
                Geen onnodige producten, geen ingewikkelde taal — gewoon eerlijk advies van 
                mensen die snappen wat ondernemen inhoudt.
              </p>
            </div>
            
            <div className="bg-secondary rounded-2xl p-8 lg:p-12">
              <blockquote className="text-xl lg:text-2xl font-medium mb-6">
                "Zzp'ers verdienen dezelfde zekerheid als werknemers, maar dan wel op een 
                manier die past bij het ondernemersleven."
              </blockquote>
              <p className="text-muted-foreground">
                — Oprichters ZP Zaken
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">Waar we voor staan</h2>
            <p className="text-lg text-muted-foreground">
              Onze kernwaarden bepalen hoe we werken en hoe we met je omgaan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-card rounded-2xl p-8 shadow-card">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <value.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {facts.map((fact) => (
              <div key={fact.label} className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2">{fact.value}</p>
                <p className="text-muted-foreground">{fact.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-8 text-center">Officieel geregistreerd</h2>
            <div className="bg-card rounded-2xl p-8 shadow-card">
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">AFM geregistreerd</p>
                    <p className="text-muted-foreground text-sm">
                      Wij staan geregistreerd bij de Autoriteit Financiële Markten als 
                      onafhankelijk adviseur.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Kifid aangesloten</p>
                    <p className="text-muted-foreground text-sm">
                      Bij klachten kun je terecht bij het Klachteninstituut Financiële Dienstverlening.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Beroepsaansprakelijkheid verzekerd</p>
                    <p className="text-muted-foreground text-sm">
                      Uiteraard zijn wij zelf ook verzekerd tegen beroepsfouten.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
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
