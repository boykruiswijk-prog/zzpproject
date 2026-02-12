import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

const benefits = [
  "Beroeps- én bedrijfsaansprakelijkheid in één polis",
  "Exclusief via ZP Zaken — nergens anders verkrijgbaar",
  "Al vanaf €15,- per maand",
  "Direct online af te sluiten",
  "Speciaal voor IT, consultancy en creatieve beroepen",
];

export function BAVSection() {
  return (
    <section className="section-padding bg-primary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
      
      <div className="container-wide relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left content */}
          <div className="text-primary-foreground">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Exclusief bij ZP Zaken
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-primary-foreground">
              BAV + AVB Combipolis
            </h2>
            
            <p className="text-lg text-primary-foreground/80 mb-6 max-w-lg">
              De enige gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering 
              in Nederland. Speciaal ontwikkeld voor zelfstandig professionals.
            </p>

            <ul className="space-y-3 mb-8">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-primary-foreground/90">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                size="xl" 
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                asChild
              >
                <LocalizedLink to="/verzekeringen">
                  <Shield className="h-5 w-5" />
                  Direct afsluiten
                  <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <Button 
                variant="outline" 
                size="xl"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <LocalizedLink to="/diensten#verzekeringen">
                  Meer informatie
                </LocalizedLink>
              </Button>
            </div>
          </div>

          {/* Right content - Feature card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center">
                <Shield className="h-7 w-7 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-foreground">BAV + AVB</h3>
                <p className="text-primary-foreground/70">Gecombineerde dekking</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">Beroepsaansprakelijkheid (BAV)</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">Bedrijfsaansprakelijkheid (AVB)</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">Rechtsbijstand optioneel</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-primary-foreground/80">Inloop- en uitloopdekking</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
            </div>

            <div className="bg-accent/20 rounded-xl p-4 text-center">
              <p className="text-primary-foreground/70 text-sm mb-1">Vanaf</p>
              <p className="text-3xl font-bold text-accent">€15,-</p>
              <p className="text-primary-foreground/70 text-sm">per maand</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
