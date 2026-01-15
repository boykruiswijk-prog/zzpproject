import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, CheckCircle, Users, Shield, Phone } from "lucide-react";
import teamHero from "@/assets/team-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${teamHero})` }}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-foreground/70" />

      <div className="container-wide relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 md:py-24 lg:py-32">
          {/* Content */}
          <div className="text-primary-foreground animate-slide-up">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-accent">Marktleider</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-sm font-medium text-primary-foreground">10+ jaar operationele ervaring</span>
              </div>
            </div>

            <h1 className="mb-6 leading-tight">
              Zorgeloos ondernemen{" "}
              <span className="text-accent">begint hier</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-6 max-w-lg">
              Verzekeringen, screening en zakelijke ondersteuning — alles wat je nodig hebt 
              als zelfstandig professional. Met persoonlijke begeleiding en de menselijke maat.
            </p>

            {/* Key USPs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Users className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Persoonlijk contact</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Betrouwbare oplossingen</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button variant="hero" size="xl" asChild>
                <Link to="/diensten">
                  Bekijk onze diensten
                  <ArrowRight className="h-5 w-5" />
                </Link>
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

          {/* Visual - Services overview */}
          <div className="hidden lg:block relative animate-fade-in">
            <div className="relative">
              {/* Main card */}
              <div className="bg-card rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Complete zakelijke dienstverlening</p>
                  <h3 className="text-2xl font-bold text-foreground">Alles onder één dak</h3>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg border border-accent/30">
                    <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Verzekeringen</span>
                      <p className="text-xs text-accent font-medium">⭐ Unieke BAV+AVB combipolis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Screening</span>
                      <p className="text-xs text-muted-foreground">Betrouwbare verificatie</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg border border-accent/30">
                    <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Verzekeringen</span>
                      <p className="text-xs text-accent font-medium">⭐ Unieke BAV+AVB combipolis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Persoonlijk advies</span>
                      <p className="text-xs text-muted-foreground">Altijd een mens bereikbaar</p>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Alles via betrouwbare partners</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Persoonlijk aanspreekpunt</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Speciaal voor ZZP'ers</span>
                  </li>
                </ul>

                <Button variant="accent" className="w-full" asChild>
                  <Link to="/diensten">
                    Ontdek alle diensten
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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
