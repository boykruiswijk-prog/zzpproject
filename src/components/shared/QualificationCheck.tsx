import { useState } from "react";
import { CheckCircle, XCircle, ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { motion, AnimatePresence } from "framer-motion";
import { trackQualificationResult } from "@/lib/tracking";

const branches = [
  "ICT / IT",
  "Finance / Accounting",
  "HR / Recruitment",
  "Marketing / Communicatie",
  "Management Consultancy",
  "Coaching / Training",
  "Juridisch / Compliance",
  "Creatief / Design",
  "Project- / Programmamanagement",
  "Anders",
];

export function QualificationCheck() {
  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState("");
  const [isPhysical, setIsPhysical] = useState<boolean | null>(null);

  const isQualified = branch !== "" && branch !== "Anders" && isPhysical === false;
  const isNotQualified = (branch === "Anders" || isPhysical === true) && step === 2;

  // Track qualification result when step 2 is reached
  if (step === 2 && branch) {
    // Using a ref-like pattern via state to fire only once per check
    if (isQualified) trackQualificationResult(true, branch);
    if (isNotQualified) trackQualificationResult(false, branch);
  }

  const reset = () => {
    setStep(0);
    setBranch("");
    setIsPhysical(null);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Briefcase className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Check in 20 seconden of je in dit pakket past</h3>
          <p className="text-xs text-muted-foreground">Onze combinatiepolis is speciaal voor kantoorberoepen</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label className="block text-sm font-medium mb-3">In welk vak werk je vooral?</label>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBranch(b); setStep(1); }}
                  className={`px-3 py-2 rounded-lg text-sm border transition-all hover:border-accent hover:bg-accent/5 ${
                    branch === b ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <label className="block text-sm font-medium mb-3">Is je werk vooral uitvoerend/fysiek (bouw, installatie, zorg aan bed)?</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setIsPhysical(true); setStep(2); }}
                className="flex-1 px-4 py-3 rounded-lg text-sm border border-border hover:border-accent hover:bg-accent/5 transition-all"
              >
                Ja, fysiek/uitvoerend
              </button>
              <button
                onClick={() => { setIsPhysical(false); setStep(2); }}
                className="flex-1 px-4 py-3 rounded-lg text-sm border border-border hover:border-accent hover:bg-accent/5 transition-all"
              >
                Nee, kantoorwerk
              </button>
            </div>
            <button onClick={() => setStep(0)} className="text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors">
              ← Vorige
            </button>
          </motion.div>
        )}

        {step === 2 && isQualified && (
          <motion.div key="qualified" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-5 text-center">
              <CheckCircle className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="font-semibold text-foreground mb-1">Je lijkt verzekerbaar via onze combinatiepolis!</p>
              <p className="text-sm text-muted-foreground mb-4">{branch} valt binnen ons aanbod voor kantoorberoepen.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="accent" size="sm" asChild>
                  <a href="#combinatiepolis">Bekijk de pakketten <ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <LocalizedLink to="/contact">Gratis adviesgesprek</LocalizedLink>
                </Button>
              </div>
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors block mx-auto">
              Opnieuw checken
            </button>
          </motion.div>
        )}

        {step === 2 && isNotQualified && (
          <motion.div key="not-qualified" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 text-center">
              <XCircle className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground mb-1">Dit pakket is bedoeld voor kantoorfuncties</p>
              <p className="text-sm text-muted-foreground mb-4">
                Maar geen zorgen — wij kunnen je helpen met een offerte op maat die wél bij jouw situatie past.
              </p>
              <Button variant="accent" size="sm" asChild>
                <LocalizedLink to="/contact">Vraag een offerte op maat aan <ArrowRight className="h-4 w-4" /></LocalizedLink>
              </Button>
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors block mx-auto">
              Opnieuw checken
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
