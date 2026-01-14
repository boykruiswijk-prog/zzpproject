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
              <span className="text-sm font-semibold text-accent">Alles voor zelfstandig professionals</span>
            </div>

            <h1 className="mb-6 leading-tight">
              Zorgeloos ondernemen{" "}
              <span className="text-accent">begint hier</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-6 max-w-lg">
              Verzekeringen, administratie, juridisch advies én screening — alles wat je nodig hebt 
              als zelfstandig professional, bij één partij geregeld.
            </p>

            {/* Key USPs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Verzekeringen</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-2 rounded-lg">
                <Users className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Screening</span>
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
                  <h3 className="text-2xl font-bold text-foreground">4 diensten, 1 partner</h3>
                </div>
                
                <div className="space-y-3 mb-6">
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
                      <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Administratie</span>
                      <p className="text-xs text-muted-foreground">Boekhouding, BTW, facturatie</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Juridisch</span>
                      <p className="text-xs text-muted-foreground">Contracten, voorwaarden</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-secondary-foreground">Screening</span>
                      <p className="text-xs text-muted-foreground">Verificatie voor opdrachtgevers</p>
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
                    <span>Persoonlijk advies</span>
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
