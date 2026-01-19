import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar } from "lucide-react";

export function CTASection() {
  return (
    <section className="section-padding bg-primary">
      <div className="container-wide">
        <div className="max-w-2xl mx-auto text-center text-primary-foreground">
          <h2 className="mb-4 text-primary-foreground">
            Klaar om zorgeloos te ondernemen?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Plan een gratis adviesgesprek en ontdek welke diensten bij jouw situatie passen. 
            Binnen 15 minuten weet je waar je aan toe bent.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button 
              size="lg" 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              asChild
            >
              <Link to="/contact">
                <Calendar className="h-5 w-5" />
                Plan een gesprek
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <a href="tel:0232010502">
                <Phone className="h-5 w-5" />
                Bel: 023 - 201 0502
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
