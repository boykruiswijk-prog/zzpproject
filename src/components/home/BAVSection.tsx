import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

export function BAVSection() {
  const { t } = useTranslation();

  const benefits = [
    t("bavSection.benefit1"),
    t("bavSection.benefit2"),
    t("bavSection.benefit3"),
    t("bavSection.benefit4"),
    t("bavSection.benefit5"),
  ];

  return (
    <section className="section-padding bg-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
      
      <div className="container-wide relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-primary-foreground">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              {t("bavSection.badge")}
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-primary-foreground">
              {t("bavSection.title")}
            </h2>
            
            <p className="text-lg text-primary-foreground/80 mb-6 max-w-lg">
              {t("bavSection.description")}
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
                  {t("bavSection.cta")}
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
                  {t("shared.moreInfo")}
                </LocalizedLink>
              </Button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center">
                <Shield className="h-7 w-7 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary-foreground">BAV + AVB</h3>
                <p className="text-primary-foreground/70">{t("bavSection.combinedCoverage")}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">{t("bavSection.bavLabel")}</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">{t("bavSection.avbLabel")}</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-primary-foreground/80">{t("bavSection.legalOptional")}</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-primary-foreground/80">{t("bavSection.runOffCoverage")}</span>
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
            </div>

            <div className="bg-accent/20 rounded-xl p-4 text-center">
              <p className="text-primary-foreground/70 text-sm mb-1">{t("bavSection.from")}</p>
              <p className="text-3xl font-bold text-accent">€15,-</p>
              <p className="text-primary-foreground/70 text-sm">{t("bavSection.perMonth")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
