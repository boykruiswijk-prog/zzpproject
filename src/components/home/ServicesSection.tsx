import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shield, UserCheck, ArrowRight, Headphones } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

export function ServicesSection() {
  const { t } = useTranslation();

  const services = [
    {
      icon: Shield,
      title: t("servicesHome.verzekeringen"),
      description: t("servicesHome.verzekeringenDesc"),
      href: "/diensten#verzekeringen",
      features: t("servicesHome.verzekeringenFeatures", { returnObjects: true }) as string[],
    },
    {
      icon: UserCheck,
      title: t("servicesHome.screening"),
      description: t("servicesHome.screeningDesc"),
      href: "/diensten#screening",
      features: t("servicesHome.screeningFeatures", { returnObjects: true }) as string[],
    },
    {
      icon: Headphones,
      title: t("servicesHome.advies"),
      description: t("servicesHome.adviesDesc"),
      href: "/contact",
      features: t("servicesHome.adviesFeatures", { returnObjects: true }) as string[],
    },
  ];

  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="mb-4">
            {t("servicesHome.title")} <span className="text-primary">{t("servicesHome.titleAccent")}</span>
          </h2>
          <p className="text-muted-foreground">
            {t("servicesHome.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {services.map((service) => (
            <LocalizedLink
              key={service.title}
              to={service.href}
              className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-200 flex flex-col"
            >
              <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors mb-4">
                <service.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                {service.title}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 flex-grow">
                {service.description}
              </p>
              <ul className="space-y-1.5 mb-4">
                {service.features.map((feature) => (
                  <li key={feature} className="text-xs text-muted-foreground flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors mt-auto">
                {t("shared.moreInfo")}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </LocalizedLink>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg" asChild>
            <LocalizedLink to="/diensten">
              {t("servicesHome.viewAll")}
              <ArrowRight className="h-5 w-5" />
            </LocalizedLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
