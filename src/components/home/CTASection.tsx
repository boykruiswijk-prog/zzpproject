import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Calendar } from "lucide-react";

export function CTASection() {
  return (
    <section className="section-padding bg-gradient-to-br from-primary via-primary to-primary/90 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-foreground rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container-wide relative">
        <div className="max-w-3xl mx-auto text-center text-primary-foreground">
          <h2 className="mb-6">
            Klaar om je onderneming te beschermen?
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Plan een gratis adviesgesprek en ontdek welke verzekeringen bij jouw situatie passen. 
            Binnen 15 minuten weet je waar je aan toe bent.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Button variant="hero" size="xl" asChild>
              <Link to="/contact">
                <Calendar className="h-5 w-5" />
                Plan een gesprek
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <a href="tel:0201234567">
                <Phone className="h-5 w-5" />
                Bel direct: 020 - 123 4567
              </a>
            </Button>
          </div>

          <p className="text-primary-foreground/60 text-sm">
            Gratis en vrijblijvend • Binnen 24 uur reactie • Geen verkooppraatjes
          </p>
        </div>
      </div>
    </section>
  );
}
