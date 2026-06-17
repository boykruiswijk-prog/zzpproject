import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/ui/animated-section";
import { LocalizedLink } from "@/components/LocalizedLink";
import { bavPakketten } from "@/data/bavPakketten";
import { cn } from "@/lib/utils";

// Pricing-section, leest uit src/data/bavPakketten.ts (single source of truth).
// Per kaart een CTA naar de BAV-wizard met het pakket-id als hash, zodat de
// wizard die selectie kan oppakken.
export function CombiPackageSection() {
  const { t } = useTranslation();

  const formatBedrag = (n: number) =>
    `€${n.toLocaleString("nl-NL")}`;

  return (
    <section className="section-padding bg-background" id="pakketten">
      <div className="container-wide">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            {t("home.allUnderOneRoof")}{" "}
            <span className="text-accent">{t("home.allUnderOneRoofAccent")}</span>
          </h2>
          <p className="text-muted-foreground">
            Kies je pakket. Alle pakketten zijn dagelijks opzegbaar en
            inclusief kosten en assurantiebelasting.
          </p>
        </AnimatedSection>

        <StaggerContainer
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12"
          staggerDelay={0.15}
        >
          {bavPakketten.map((pkg) => {
            const isHighlighted = pkg.id === "jaarlijks-cyber";
            return (
              <StaggerItem key={pkg.id}>
                <div
                  className={cn(
                    "relative h-full bg-card rounded-2xl border-2 p-6 flex flex-col transition-shadow hover:shadow-lg",
                    isHighlighted
                      ? "border-accent shadow-md"
                      : pkg.label
                      ? "border-primary/30"
                      : "border-border"
                  )}
                >
                  {pkg.label && (
                    <span
                      className={cn(
                        "absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap",
                        isHighlighted
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {pkg.label}
                    </span>
                  )}

                  <div className="mb-4">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                      <Shield className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="font-bold text-lg">{pkg.name}</h3>
                  </div>

                  <div className="mb-5">
                    <p className="text-3xl font-bold text-foreground whitespace-nowrap">
                      €{pkg.prijs}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}/ {pkg.periode}
                      </span>
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm mb-5">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-x-2">
                        <span>BAV per gebeurtenis</span>
                        <span className="font-semibold whitespace-nowrap">
                          {formatBedrag(pkg.dekkingen.bav.perGebeurtenis)}
                        </span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-x-2">
                        <span>AVB per gebeurtenis</span>
                        <span className="font-semibold whitespace-nowrap">
                          {formatBedrag(pkg.dekkingen.avb.perGebeurtenis)}
                        </span>
                      </div>
                    </li>
                    {pkg.dekkingen.cyber && (
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        <div className="flex-1 flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-x-2">
                          <span>Cyber per jaar</span>
                          <span className="font-semibold whitespace-nowrap">
                            {formatBedrag(pkg.dekkingen.cyber.perJaar)}
                          </span>
                        </div>
                      </li>
                    )}
                    {pkg.usps.map((u) => (
                      <li key={u} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <Button
                      variant={isHighlighted ? "accent" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <LocalizedLink to={`/#combinatiepolis?pakket=${pkg.id}`}>
                        Kies dit pakket
                        <ArrowRight className="h-4 w-4" />
                      </LocalizedLink>
                    </Button>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <AnimatedSection delay={0.3} className="text-center">
          <Button variant="outline" size="lg" asChild>
            <LocalizedLink to="/diensten">
              {t("home.bekijkAlleDiensten")}
              <ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </Button>
        </AnimatedSection>
      </div>
    </section>
  );
}
