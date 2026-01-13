import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, CheckCircle } from "lucide-react";

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
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Onafhankelijk advies voor zzp'ers</span>
            </div>

            <h1 className="mb-6 leading-tight">
              Zakelijke zekerheid,{" "}
              <span className="text-accent">zonder gedoe</span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-lg">
              Als zzp'er wil je je focussen op je werk, niet op papierwerk. 
              Wij regelen je verzekeringen en geven helder advies — direct, persoonlijk en zonder tussenpersonen.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button variant="hero" size="xl" asChild>
                <Link to="/contact">
                  Gratis adviesgesprek
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <Link to="/verzekeringen">Bekijk verzekeringen</Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-primary-foreground/70">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                <span>100% onafhankelijk</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                <span>Geen tussenpersonen</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                <span>Direct persoonlijk contact</span>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="hidden lg:block relative animate-fade-in">
            <div className="relative">
              {/* Main card */}
              <div className="bg-card rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-card-foreground">2.500+ zzp'ers</p>
                    <p className="text-sm text-muted-foreground">vertrouwen op zpzaken</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-secondary-foreground">Beroepsaansprakelijkheid</span>
                    <span className="text-sm text-accent font-semibold">Actief ✓</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-secondary-foreground">Arbeidsongeschiktheid</span>
                    <span className="text-sm text-accent font-semibold">Actief ✓</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-secondary-foreground">Rechtsbijstand</span>
                    <span className="text-sm text-accent font-semibold">Actief ✓</span>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-full shadow-lg font-semibold text-sm">
                ⭐ 4.9/5 rating
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
