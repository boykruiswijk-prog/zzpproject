import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { PageHero } from "@/components/layout/PageHero";
import { MessageSquare, Phone, Mail, Scale, Shield, CheckCircle2 } from "lucide-react";

const tocItems = [
  { id: "stap-1", label: "Stap 1 — Neem contact met ons op" },
  { id: "stap-2", label: "Stap 2 — Wij behandelen uw klacht" },
  { id: "stap-3", label: "Stap 3 — Kifid als externe klachteninstantie" },
  { id: "stap-4", label: "Stap 4 — Geschil voorleggen aan de rechter" },
  { id: "belofte", label: "Onze belofte aan u" },
  { id: "contact", label: "Contactgegevens" },
];

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-2xl md:text-3xl font-bold mb-6">{title}</h2>
    <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

export default function Klachtenprocedure() {
  return (
    <Layout>
      <SEOHead
        title="Klachtenprocedure | ZP Zaken"
        description="Hoe ZP Zaken omgaat met klachten over de dienstverlening. AFM geregistreerd en aangesloten bij Kifid."
      />
      <PageHero
        title="Klachtenprocedure"
        subtitle="Hoe wij omgaan met klachten over onze dienstverlening"
        badge={{
          icon: <MessageSquare className="h-4 w-4" />,
          text: "Versie: april 2026",
        }}
      />

      {/* Introductie */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-muted-foreground leading-relaxed">
              ZP Zaken B.V. hecht groot belang aan de tevredenheid van haar klanten. Bent u niet tevreden over onze dienstverlening? Dan horen wij dat graag. Wij behandelen uw klacht serieus, vertrouwelijk en zo snel mogelijk. ZP Zaken is geregistreerd bij de Autoriteit Financiële Markten (AFM) onder vergunningsnummer <strong>12050636</strong> en aangesloten bij het Klachteninstituut Financiële Dienstverlening (Kifid).
            </p>
          </div>
        </div>
      </section>

      {/* Inhoudsopgave */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <div className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 shadow-card">
              <h2 className="text-xl font-bold mb-4">Inhoudsopgave</h2>
              <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-sm text-accent hover:underline">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Stappen */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto space-y-16">
            <Section id="stap-1" title="Stap 1 — Neem contact met ons op">
              <p>Dien uw klacht eerst in bij ZP Zaken zelf. Dat kan op de volgende manieren:</p>
              <div className="grid sm:grid-cols-3 gap-4 not-prose pt-2">
                <div className="bg-card rounded-xl border border-border/50 p-4 shadow-card">
                  <Mail className="h-5 w-5 text-accent mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Per e-mail</p>
                  <a href="mailto:klachten@zpzaken.nl" className="text-sm font-semibold text-foreground hover:text-accent transition-colors">klachten@zpzaken.nl</a>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-4 shadow-card">
                  <Phone className="h-5 w-5 text-accent mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Telefonisch</p>
                  <a href="tel:0204573077" className="text-sm font-semibold text-foreground hover:text-accent transition-colors">020 - 457 3077</a>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-4 shadow-card">
                  <MessageSquare className="h-5 w-5 text-accent mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Per post</p>
                  <p className="text-sm font-semibold text-foreground">ZP Zaken B.V.<br />Tupolevlaan 41<br />1119 NW Schiphol-Rijk</p>
                </div>
              </div>
              <p className="pt-2">Vermeld bij uw klacht:</p>
              <ul className="space-y-2 ml-4">
                {[
                  "Uw naam en contactgegevens",
                  "Een duidelijke omschrijving van de klacht",
                  "De datum waarop het voorval heeft plaatsgevonden",
                  "Wat u van ons verwacht als oplossing",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-accent mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="stap-2" title="Stap 2 — Wij behandelen uw klacht">
              <p>Na ontvangst van uw klacht ontvangt u binnen <strong>5 werkdagen</strong> een schriftelijke ontvangstbevestiging.</p>
              <p>Wij streven ernaar uw klacht binnen <strong>6 weken</strong> volledig te behandelen. Indien dit niet mogelijk is, ontvangt u hierover tijdig bericht met een indicatie van de nieuwe verwachte afdoeningtermijn.</p>
              <p>U ontvangt onze reactie schriftelijk, met daarin:</p>
              <ul className="space-y-2 ml-4">
                {[
                  "Een oordeel over uw klacht",
                  "Een toelichting op dit oordeel",
                  "Eventuele vervolgstappen of oplossingen",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-accent mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="stap-3" title="Stap 3 — Kifid als externe klachteninstantie">
              <p>Bent u niet tevreden met de uitkomst van onze klachtbehandeling, of heeft u na 6 weken nog geen reactie ontvangen? Dan kunt u uw klacht voorleggen aan het Klachteninstituut Financiële Dienstverlening (Kifid).</p>
              <p>Kifid is een onafhankelijke instantie die geschillen behandelt tussen consumenten en financiële dienstverleners.</p>
              <div className="bg-secondary rounded-xl p-6 mt-2 text-sm space-y-1">
                <p className="font-semibold text-foreground">Kifid</p>
                <p>Postbus 93257</p>
                <p>2509 AG Den Haag</p>
                <p>Telefoon: <a href="tel:09003552248" className="text-accent hover:underline">0900 - 355 22 48</a></p>
                <p>Website: <a href="https://www.kifid.nl" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">www.kifid.nl</a></p>
              </div>
              <p className="pt-2">
                U kunt uw klacht online indienen via{" "}
                <a href="https://www.kifid.nl/klacht-indienen" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  www.kifid.nl/klacht-indienen
                </a>
                . Kifid hanteert eigen termijnen en voorwaarden voor het indienen van een klacht. Raadpleeg de website van Kifid voor actuele informatie.
              </p>
            </Section>

            <Section id="stap-4" title="Stap 4 — Geschil voorleggen aan de rechter">
              <p>U heeft ook altijd het recht om uw klacht voor te leggen aan de bevoegde rechter, ongeacht of u gebruik heeft gemaakt van de Kifid-procedure.</p>
              <p>Op alle geschillen tussen ZP Zaken en haar klanten is Nederlands recht van toepassing.</p>
            </Section>

            <Section id="belofte" title="Onze belofte aan u">
              <p>Wij behandelen elke klacht:</p>
              <div className="grid sm:grid-cols-2 gap-3 not-prose pt-2">
                {[
                  "Serieus en met respect",
                  "Vertrouwelijk",
                  "Zonder extra kosten voor u",
                  "Binnen de gestelde termijnen",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 bg-card rounded-xl border border-border/50 p-4 shadow-card">
                    <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <p className="pt-4">Uw klacht helpt ons onze dienstverlening te verbeteren. Wij zijn u erkentelijk voor uw terugkoppeling.</p>
            </Section>

            <Section id="contact" title="Contactgegevens">
              <div className="bg-secondary rounded-xl p-6 text-sm space-y-1">
                <p className="font-semibold text-foreground">ZP Zaken B.V.</p>
                <p>Tupolevlaan 41</p>
                <p>1119 NW Schiphol-Rijk</p>
                <p>E-mail: <a href="mailto:klachten@zpzaken.nl" className="text-accent hover:underline">klachten@zpzaken.nl</a></p>
                <p>Telefoon: <a href="tel:0204573077" className="text-accent hover:underline">020 - 457 3077</a></p>
                <p>KvK: 62117092</p>
                <p>AFM vergunningsnummer: 12050636</p>
                <p className="flex items-center gap-2 pt-2">
                  <Shield className="h-4 w-4 text-accent" />
                  <span>Kifid aangesloten</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground pt-4 flex items-center gap-2">
                <Scale className="h-3 w-3" />
                Versie: april 2026
              </p>
            </Section>
          </div>
        </div>
      </section>
    </Layout>
  );
}
