import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, LucideIcon } from "lucide-react";

interface ServiceCardProps {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  forWho: string;
  cta: string;
  href: string;
  partners: string[];
  backgroundImage: string;
  index: number;
}

export function ServiceCard({
  id,
  icon: Icon,
  title,
  subtitle,
  description,
  features,
  forWho,
  cta,
  href,
  partners,
  backgroundImage,
  index,
}: ServiceCardProps) {
  const isReversed = index % 2 === 1;

  return (
    <section
      id={id}
      className="relative min-h-[600px] lg:min-h-[500px] scroll-mt-24 overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={backgroundImage}
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
      </div>

      {/* Content */}
      <div className="container-wide relative z-10 py-16 lg:py-20">
        <div className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${isReversed ? 'lg:grid-flow-col-dense' : ''}`}>
          {/* Text Content */}
          <div className={isReversed ? 'lg:col-start-2' : ''}>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-xl bg-accent/20 backdrop-blur-sm flex items-center justify-center border border-accent/30">
                <Icon className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl text-primary-foreground">{title}</h2>
                <p className="text-primary-foreground/70">{subtitle}</p>
              </div>
            </div>

            <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
              {description}
            </p>

            <ul className="grid sm:grid-cols-2 gap-3 mb-8">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-primary-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-4">
              <Button variant="accent" size="lg" asChild>
                <Link to={href}>
                  {cta}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="heroOutline" size="lg" asChild>
                <Link to="/contact">
                  Vraag advies aan
                </Link>
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <div className={`bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-border/50 ${isReversed ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
            <h3 className="font-semibold text-lg mb-6">Overzicht</h3>
            <div className="space-y-5">
              <div className="p-5 bg-secondary rounded-xl">
                <p className="text-sm text-muted-foreground mb-2">Geschikt voor</p>
                <p className="font-medium">{forWho}</p>
              </div>
              <div className="p-5 bg-secondary rounded-xl">
                <p className="text-sm text-muted-foreground mb-3">Via onze partners</p>
                <div className="flex flex-wrap gap-2">
                  {partners.map((partner) => (
                    <span
                      key={partner}
                      className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full font-medium"
                    >
                      {partner}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-5 bg-accent/10 rounded-xl border border-accent/20">
                <p className="text-sm font-medium text-accent">
                  💡 Alles via betrouwbare partners, met persoonlijk advies van ZP Zaken.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
