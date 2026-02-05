import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar, ArrowRight } from "lucide-react";
import teamBoyCalling from "@/assets/team-boy-calling.jpg";

export function CTASection() {
  return (
    <section className="relative section-padding overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={teamBoyCalling}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
      </div>

      <div className="container-wide relative z-10">
        <div className="max-w-2xl mx-auto text-center text-primary-foreground">
          <h2 className="mb-4 text-primary-foreground">
            Klaar om zorgeloos te ondernemen?
          </h2>
          <p className="text-primary-foreground/85 text-lg mb-8 max-w-xl mx-auto">
            Plan een gratis adviesgesprek en ontdek welke diensten bij jouw situatie passen. 
            Binnen 15 minuten weet je waar je aan toe bent.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              size="xl" 
              className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
              asChild
            >
              <Link to="/contact">
                <Calendar className="h-5 w-5" />
                Plan een gesprek
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <span className="text-primary-foreground/60 hidden sm:block">of</span>
            <a 
              href="tel:0232010502" 
              className="inline-flex items-center gap-2 text-primary-foreground hover:text-primary-foreground transition-colors font-medium border border-primary-foreground/40 rounded-lg px-4 py-2 hover:bg-primary-foreground/10"
            >
              <Phone className="h-4 w-4" />
              023 - 201 0502
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/70 text-sm">
            <span>✓ Gratis en vrijblijvend</span>
            <span>✓ Binnen 24 uur reactie</span>
            <span>✓ 13+ jaar marktleider</span>
          </div>
        </div>
      </div>
    </section>
  );
}
