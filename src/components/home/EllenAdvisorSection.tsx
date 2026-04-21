import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { AnimatedSection } from "@/components/ui/animated-section";
import ellenPortrait from "@/assets/ellen-baars-portrait.jpg";

export function EllenAdvisorSection() {
  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <AnimatedSection>
          <div
            className="bg-card grid lg:grid-cols-2 gap-8 lg:gap-12 items-center shadow-lg border border-border/50"
            style={{ padding: "40px", borderRadius: "16px" }}
          >
            <div>
              <img
                src={ellenPortrait}
                alt="Ellen Baars - Senior Adviseur ZP Zaken"
                className="w-full object-cover"
                style={{ height: "320px", borderRadius: "12px", objectPosition: "center top" }}
              />
            </div>
            <div>
              <span className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full text-xs font-medium mb-4">
                Persoonlijk advies
              </span>
              <h2 className="mb-1 text-2xl lg:text-3xl">Ellen Baars</h2>
              <p className="text-accent font-medium mb-5">Senior Adviseur — ZP Zaken</p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "Als je een vraag hebt over verzekeringen bel je niet naar een callcenter. Je belt met mij. Ik ken de markt, ik ken de valkuilen en ik weet wat jij als zzp'er nodig hebt. Dat is precies waarom zzp'ers voor ZP Zaken kiezen."
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  "Altijd een mens aan de lijn",
                  "Binnen 24 uur reactie",
                  "13+ jaar marktkennis",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/contact">
                  Stel Ellen je vraag
                  <ArrowRight className="h-4 w-4" />
                </LocalizedLink>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
