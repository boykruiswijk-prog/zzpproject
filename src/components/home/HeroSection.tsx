import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Phone } from "lucide-react";

export function HeroSection() {
  return (
    <section className="bg-secondary py-12 md:py-16 lg:py-24">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="animate-slide-up">
            <h1 className="mb-6 leading-tight">
              Zorgeloos ondernemen{" "}
              <span className="text-primary">begint hier</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Verzekeringen, screening en zakelijke ondersteuning — alles wat je nodig hebt 
              als zelfstandig professional. Met persoonlijke begeleiding en de menselijke maat.
            </p>

            {/* Key USPs */}
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-foreground">Persoonlijk contact, altijd een mens aan de lijn</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-foreground">Unieke BAV+AVB combinatiepolis</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-foreground">Transparant advies, geen verborgen kosten</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button variant="accent" size="lg" asChild>
                <Link to="/diensten">
                  Bekijk onze diensten
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/contact">Gratis adviesgesprek</Link>
              </Button>
            </div>

            {/* Contact */}
            <a 
              href="tel:0232010502" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span>023 - 201 0502</span>
            </a>
          </div>

          {/* Visual */}
          <div className="hidden lg:block animate-fade-in">
            <div className="relative">
              {/* Illustration placeholder - using a styled card */}
              <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
                <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-accent/20 mb-4">
                      <CheckCircle className="h-10 w-10 text-accent" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">2.500+ zzp'ers</h3>
                    <p className="text-muted-foreground">gingen je voor</p>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-full shadow-lg font-semibold text-sm flex items-center gap-2">
                ⭐ 4.9/5 Google
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
