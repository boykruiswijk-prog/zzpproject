import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Eye, Users, Award, CheckCircle, Heart } from "lucide-react";
import teamMember1 from "@/assets/team-member-1.jpg";
import teamMember2 from "@/assets/team-member-2.jpg";
import teamMember3 from "@/assets/team-member-3.jpg";

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

export default function OverOns() {
  return (
    <Layout>
      <PageHero
        title="Over ZP Zaken"
        subtitle="Wij geloven dat zzp'ers recht hebben op eerlijk, persoonlijk advies. Zonder tussenpersonen, zonder verkooppraatjes — gewoon goed geregeld."
        badge={{
          icon: <Heart className="h-4 w-4" />,
          text: "Met passie voor ondernemers"
        }}
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
              <p className="text-lg text-muted-foreground">
                Geen onnodige producten, geen ingewikkelde taal — gewoon eerlijk advies van 
                mensen die snappen wat ondernemen inhoudt.
              </p>
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
              <div key={member.name} className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{member.name}</h3>
                  <p className="text-accent font-medium mb-3">{member.role}</p>
                  <p className="text-muted-foreground text-sm">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="mb-4">Waar we voor staan</h2>
            <p className="text-lg text-muted-foreground">
              Onze kernwaarden bepalen hoe we werken en hoe we met je omgaan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
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
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {facts.map((fact) => (
              <div key={fact.label} className="text-center">
                <p className="text-4xl md:text-5xl font-bold mb-2">{fact.value}</p>
                <p className="text-primary-foreground/70">{fact.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-8 text-center">Officieel geregistreerd</h2>
            <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
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
