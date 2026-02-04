import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Phone, Shield, Users } from "lucide-react";
import teamMeeting from "@/assets/team-meeting.jpg";

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={teamMeeting}
          alt="ZP Zaken - Professionele ondersteuning voor zzp'ers"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
      </div>

      <div className="container-wide relative z-10 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="animate-slide-up">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary-foreground px-4 py-2 rounded-full mb-6">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Al 10+ jaar dé partner voor zzp'ers</span>
            </div>

            <h1 className="mb-6 leading-tight text-primary-foreground">
              Zorgeloos ondernemen{" "}
              <span className="text-primary">begint hier</span>
            </h1>

            <p className="text-lg text-primary-foreground/80 mb-8 max-w-lg">
              Verzekeringen, screening en zakelijke ondersteuning — alles wat je nodig hebt 
              als zelfstandig professional. Met persoonlijke begeleiding en de menselijke maat.
            </p>

            {/* Key USPs */}
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-primary-foreground">Persoonlijk contact, altijd een mens aan de lijn</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-primary-foreground">Unieke BAV+AVB combinatiepolis</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-primary-foreground">Transparant advies, geen verborgen kosten</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button variant="accent" size="xl" asChild className="shadow-lg">
                <Link to="/diensten">
                  Bekijk onze diensten
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="xl" 
                asChild
                className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 backdrop-blur-sm border border-primary-foreground/50"
              >
                <Link to="/contact">Gratis adviesgesprek</Link>
              </Button>
            </div>

            {/* Contact */}
            <a 
              href="tel:0232010502" 
              className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span>023 - 201 0502</span>
            </a>
          </div>

          {/* Stats Card - More Corporate */}
          <div className="hidden lg:flex justify-end">
            <div className="relative">
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-border/50 max-w-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-foreground">2.500+</h3>
                    <p className="text-muted-foreground">tevreden zzp'ers</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Klanttevredenheid</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-foreground">4.9/5</span>
                      <span className="text-amber-500">⭐</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Reactietijd</span>
                    <span className="font-semibold text-foreground">&lt; 24 uur</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">Ervaring</span>
                    <span className="font-semibold text-foreground">10+ jaar</span>
                  </div>
                </div>
              </div>

              {/* Floating accent */}
              <div className="absolute -bottom-4 -left-4 bg-accent text-accent-foreground px-5 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Direct advies
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
