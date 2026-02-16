import { Monitor, Target, Package, Eye } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";
import { useTranslation } from "react-i18next";

export function WhyAffordable() {
  const { t } = useTranslation();

  const reasons = [
    { icon: Monitor, title: t("whyAffordable.reason1"), desc: t("whyAffordable.reason1Desc") },
    { icon: Target, title: t("whyAffordable.reason2"), desc: t("whyAffordable.reason2Desc") },
    { icon: Package, title: t("whyAffordable.reason3"), desc: t("whyAffordable.reason3Desc") },
  ];

  return (
    <AnimatedSection className="bg-card border border-border rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Eye className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">{t("whyAffordable.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("whyAffordable.subtitle")}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        {reasons.map((r) => (
          <div key={r.title} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <r.icon className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-medium text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        <strong>{t("whyAffordable.disclaimer")}</strong> {t("whyAffordable.disclaimerText")}
      </p>
    </AnimatedSection>
  );
}
