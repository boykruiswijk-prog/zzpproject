import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone, MessageSquare } from "lucide-react";

export default function Contact() {
  return (
    <Layout>
      <SEOHead
        title="Contact | ZP Zaken — Gratis adviesgesprek voor ZZP'ers"
        description="Vraag een gratis en vrijblijvend adviesgesprek aan. Wij helpen je binnen 24 uur aan de juiste verzekering. Bereikbaar via telefoon, e-mail en chat."
        canonical="/contact"
        schema={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact ZP Zaken",
          url: "https://zpzaken.nl/contact",
          description: "Neem contact op met ZP Zaken voor gratis verzekeringsadvies voor ZZP'ers.",
        }}
      />

      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">Neem contact op</h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              Heb je een vraag of wil je een vrijblijvend adviesgesprek? We helpen je graag. Binnen 24 uur geregeld.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-3 gap-8 mb-16">

            <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50 flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Phone className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Telefoon</h3>
              <p className="text-muted-foreground">Bel ons direct voor een snel antwoord op je vraag.</p>
              <a href="tel:+31000000000" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline mt-auto">
                +31 (0)00 000 0000
              </a>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50 flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">E-mail</h3>
              <p className="text-muted-foreground">Stuur ons een bericht en we reageren binnen één werkdag.</p>
              <a href="mailto:info@zpzaken.nl" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline mt-auto">
                info@zpzaken.nl
              </a>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50 flex flex-col items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Adviesgesprek</h3>
              <p className="text-muted-foreground">Plan een gratis en vrijblijvend gesprek in op een moment dat jou uitkomt.</p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-accent mt-auto">
                Gratis en vrijblijvend
              </span>
            </div>

          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-card rounded-2xl p-8 md:p-12 shadow-card border border-border/50">
              <h2 className="text-2xl font-semibold mb-2">Stuur ons een bericht</h2>
              <p className="text-muted-foreground mb-8">
                Vul het formulier in en we nemen zo snel mogelijk contact met je op.
              </p>
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Voornaam</label>
                    <input
                      type="text"
                      placeholder="Jan"
                      className="px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Achternaam</label>
                    <input
                      type="text"
                      placeholder="Jansen"
                      className="px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">E-mailadres</label>
                  <input
                    type="email"
                    placeholder="jan@bedrijf.nl"
                    className="px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Telefoonnummer</label>
                  <input
                    type="tel"
                    placeholder="+31 6 00 000 000"
                    className="px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Bericht</label>
                  <textarea
                    rows={5}
                    placeholder="Waar kunnen we je mee helpen?"
                    className="px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/50 transition resize-none"
                  />
                </div>
                <Button variant="accent" size="lg" className="w-full">
                  Verstuur bericht
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Je gegevens worden vertrouwelijk behandeld en nooit gedeeld met derden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}