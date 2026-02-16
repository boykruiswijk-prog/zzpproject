import { useState } from "react";
import { CheckCircle, ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { motion, AnimatePresence } from "framer-motion";
import { trackQualificationResult } from "@/lib/tracking";
import { useTranslation } from "react-i18next";

export function QualificationCheck() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState("");
  const [branchIndex, setBranchIndex] = useState(-1);
  const [_isPhysical, setIsPhysical] = useState<boolean | null>(null);

  const branches = t("qualification.branches", { returnObjects: true }) as string[];
  const isComplete = step === 2 && branch !== "";

  if (isComplete) {
    trackQualificationResult(true, branch);
  }

  const reset = () => {
    setStep(0);
    setBranch("");
    setBranchIndex(-1);
    setIsPhysical(null);
  };

  const isOther = branchIndex === branches.length - 1;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Briefcase className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">{t("qualification.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("qualification.subtitle")}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label className="block text-sm font-medium mb-3">{t("qualification.question1")}</label>
            <div className="flex flex-wrap gap-2">
              {branches.map((b, i) => (
                <button
                  key={b}
                  onClick={() => { setBranch(b); setBranchIndex(i); setStep(1); }}
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
            <label className="block text-sm font-medium mb-3">{t("qualification.question2")}</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setIsPhysical(true); setStep(2); }}
                className="flex-1 px-4 py-3 rounded-lg text-sm border border-border hover:border-accent hover:bg-accent/5 transition-all"
              >
                {t("qualification.yesPhysical")}
              </button>
              <button
                onClick={() => { setIsPhysical(false); setStep(2); }}
                className="flex-1 px-4 py-3 rounded-lg text-sm border border-border hover:border-accent hover:bg-accent/5 transition-all"
              >
                {t("qualification.noOffice")}
              </button>
            </div>
            <button onClick={() => setStep(0)} className="text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors">
              {t("qualification.previous")}
            </button>
          </motion.div>
        )}

        {step === 2 && isComplete && (
          <motion.div key="qualified" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-5 text-center">
              <CheckCircle className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="font-semibold text-foreground mb-1">
                {isOther
                  ? t("qualification.resultOther")
                  : t("qualification.resultMatch")}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {isOther
                  ? t("qualification.resultOtherSub")
                  : `${branch} ${t("qualification.resultMatchSub")}`}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="accent" size="sm" asChild>
                  <a href="#combinatiepolis">{t("shared.viewPackages")} <ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <LocalizedLink to="/contact">{t("shared.freeConsultation")}</LocalizedLink>
                </Button>
              </div>
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors block mx-auto">
              {t("shared.retryCheck")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
