import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, UserCheck, Headphones, Heart, ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";

const benefits = [
  {
    icon: Shield,
    title: "Verzekeringen",
    description: "Unieke BAV+AVB combipolis",
  },
  {
    icon: UserCheck,
    title: "Screening",
    description: "Verificatie voor opdrachtgevers",
  },
  {
    icon: Headphones,
    title: "Persoonlijk advies",
    description: "Altijd een mens aan de lijn",
  },
  {
    icon: Heart,
    title: "Menselijke maat",
    description: "Geen callcenters",
  },
];

export function CombiPackageSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        {/* Compact header */}
        <AnimatedSection className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Alles onder <span className="text-accent">één dak</span>
          </h2>
          <p className="text-muted-foreground">
            Focus op je werk, wij regelen de rest — met persoonlijke begeleiding.
          </p>
        </AnimatedSection>

        {/* Simple icon row */}
        <StaggerContainer className="flex flex-wrap justify-center gap-8 md:gap-12 mb-10" staggerDelay={0.15}>
          {benefits.map((benefit) => (
            <StaggerItem 
              key={benefit.title}
            >
              <div className="flex flex-col items-center text-center max-w-[140px] group">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-accent/20 transition-all duration-300">
                <benefit.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-medium text-sm mb-1">{benefit.title}</h3>
              <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Minimal USP line */}
        <AnimatedSection delay={0.3} className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-8">
          {["Betrouwbare partners", "Speciaal voor ZZP'ers", "Transparante tarieven"].map((text) => (
            <span key={text} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-accent" />
              {text}
            </span>
          ))}
        </AnimatedSection>

        {/* Simple CTA */}
        <AnimatedSection delay={0.4} className="text-center">
          <Button variant="outline" size="lg" asChild className="hover:scale-105 transition-transform duration-200">
            <Link to="/diensten">
              Bekijk alle diensten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
