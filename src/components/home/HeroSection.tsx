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
      <div className="absolute inset-0 bg-primary/80" />

      <div className="container-wide relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 md:py-24 lg:py-32">
          {/* Content */}
          <div className="text-primary-foreground animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Tech met de menselijke maat</span>
            </div>

            <h1 className="mb-6 leading-tight">
              Technologie die{" "}
              <span className="text-accent">écht werkt</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-6 max-w-lg">
              Slimme tech-oplossingen met persoonlijke begeleiding. Wij combineren innovatie 
              met een menselijke aanpak — want technologie draait om mensen.
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
                  Ontdek onze oplossingen
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/contact">Gratis kennismaking</Link>
              </Button>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-4 text-sm text-primary-foreground/70">
              <a href="tel:0232010502" className="flex items-center gap-2 hover:text-accent transition-colors">
                <Phone className="h-4 w-4" />
                <span>023-2010502</span>
              </a>
              <span>•</span>
              <span>Altijd een mens aan de lijn</span>
            </div>
          </div>

          {/* Visual - Services overview */}
          <div className="hidden lg:block relative animate-fade-in">
            <div className="relative">
              {/* Main card */}
              <div className="bg-card rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Tech dienstverlening met een menselijk gezicht</p>
                  <h3 className="text-2xl font-bold text-foreground">Innovatie + persoonlijke aanpak</h3>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Software op maat</span>
                      <p className="text-xs text-muted-foreground">Webapps, automatisering, AI</p>
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
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Verzekeringen</span>
                      <p className="text-xs text-muted-foreground">BAV, AOV, rechtsbijstand</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Support & onderhoud</span>
                      <p className="text-xs text-muted-foreground">Altijd bereikbaar</p>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Geen jargon, wel resultaat</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Persoonlijk aanspreekpunt</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    <span>Technologie die werkt voor jou</span>
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
