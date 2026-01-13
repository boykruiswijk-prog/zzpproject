import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, CheckCircle, Clock, Calendar, Phone } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-foreground rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container-wide relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 md:py-24 lg:py-32">
          {/* Content */}
          <div className="text-primary-foreground animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Goedkoopste van Nederland</span>
            </div>

            <h1 className="mb-6 leading-tight">
              Beroeps- & Bedrijfsaansprakelijkheid{" "}
              <span className="text-accent">vanaf €50/maand</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-6 max-w-lg">
              De verzekering die elke zzp'er nodig heeft. Bescherm jezelf tegen claims 
              en werk zorgeloos voor je opdrachtgevers.
            </p>

            {/* Key USPs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Binnen 24 uur geregeld</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Calendar className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Dagelijks opzegbaar</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button variant="hero" size="xl" asChild>
                <a href="https://shop.zpzaken.nl/bav-jaarlijks" target="_blank" rel="noopener noreferrer">
                  Direct afsluiten
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/contact">Gratis adviesgesprek</Link>
              </Button>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-4 text-sm text-primary-foreground/70">
              <a href="tel:0232010502" className="flex items-center gap-2 hover:text-accent transition-colors">
                <Phone className="h-4 w-4" />
                <span>023-2010502</span>
              </a>
              <span>•</span>
              <span>Persoonlijk advies</span>
            </div>
          </div>

          {/* Visual - Pricing preview */}
          <div className="hidden lg:block relative animate-fade-in">
            <div className="relative">
              {/* Main card */}
              <div className="bg-card rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">BAV + AVB Combi-pakket</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-foreground">€600</span>
                    <span className="text-muted-foreground">/jaar</span>
                  </div>
                  <p className="text-sm text-accent font-medium mt-2">€60 korting t.o.v. maandelijks</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-secondary-foreground">Beroepsaansprakelijkheid</span>
                    </div>
                    <span className="text-xs text-muted-foreground">€5 mln</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-secondary-foreground">Bedrijfsaansprakelijkheid</span>
                    </div>
                    <span className="text-xs text-muted-foreground">€2,5 mln</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Dagelijks opzegbaar</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Inclusief juridische bijstand</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Directe dekking na afsluiten</span>
                  </li>
                </ul>

                <Button variant="accent" className="w-full" asChild>
                  <a href="https://shop.zpzaken.nl/bav-jaarlijks" target="_blank" rel="noopener noreferrer">
                    Direct afsluiten
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-full shadow-lg font-semibold text-sm">
                ⭐ 4.9/5 rating
              </div>

              {/* Trust badge */}
              <div className="absolute -bottom-4 -left-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg font-medium text-sm">
                2.500+ zzp'ers
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
