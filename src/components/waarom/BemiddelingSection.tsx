import { motion } from "framer-motion";
import { X, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fade = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const intermediairPoints = [
  "Betaal een percentage van je uurtarief als bemiddelingsfee",
  "Jij staat in hun database als één van de 50.000+ professionals",
  "Een algoritme bepaalt of jij wordt voorgesteld",
  "Je hebt geen direct contact met de recruiter",
  "Opdrachten via vaste preferred suppliers — jij buiten beschouwing?",
  "Jij betaalt indirect mee aan hun merkbudget, Formule 1-sponsoring en kantorenpanden",
];

const onefellowPoints = [
  "Bemiddeling is gratis voor de zzp'er",
  "Persoonlijk contact met een recruiter die jouw profiel kent",
  "Actief voorgesteld bij opdrachtgevers — niet passief in een database",
  "Jij betaalt niets: de opdrachtgever betaalt de fee",
  "Werkzaam in heel Nederland",
  "Specialisatie in ZZP, detachering, detavast en payrolling",
];

export function BemiddelingSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="mb-4">Opdrachten vinden zonder bemiddelingskosten</h2>
          <p className="text-muted-foreground">
            Naast verzekeringen helpt ZP Zaken je ook aan opdrachten via Onefellow — het recruitmentplatform van dezelfde mensen. Bemiddeling is gratis voor de zzp'er. Jij betaalt niets, de opdrachtgever betaalt de fee.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-10">
          {/* Intermediairs column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-muted rounded-2xl p-8 border border-border"
          >
            <h3 className="text-lg font-bold text-muted-foreground mb-6">Bemiddeling via een traditioneel platform</h3>
            <ul className="space-y-4">
              {intermediairPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Onefellow column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-accent/5 rounded-2xl p-8 border-2 border-accent"
          >
            <h3 className="text-lg font-bold text-accent mb-6">Bemiddeling via Onefellow</h3>
            <ul className="space-y-4">
              {onefellowPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center max-w-2xl mx-auto">
          <p className="text-muted-foreground mb-6">
            Onefellow is het recruitmentbedrijf van dezelfde mensen achter ZP Zaken. Wij bemiddelen gratis voor jou. Jij solliciteert bij ons — niet andersom.
          </p>
          <Button variant="accent" size="lg" asChild>
            <a href="https://www.onefellow.nl" target="_blank" rel="noopener noreferrer">
              Meld je aan bij Onefellow <ArrowRight className="h-5 w-5" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
