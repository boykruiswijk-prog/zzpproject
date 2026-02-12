import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, LucideIcon, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { LocalizedLink } from "@/components/LocalizedLink";

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
  id, icon: Icon, title, subtitle, description, features, forWho, cta, href, partners, backgroundImage, index,
}: ServiceCardProps) {
  const isReversed = index % 2 === 1;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": title,
    "description": description,
    "provider": { "@type": "Organization", "name": "ZP Zaken", "url": "https://zpzaken.nl" },
    "areaServed": { "@type": "Country", "name": "Nederland" },
    "audience": { "@type": "Audience", "audienceType": forWho },
    "serviceType": title,
    "offers": { "@type": "Offer", "availability": "https://schema.org/InStock" }
  };

  return (
    <section id={id} className="relative min-h-[550px] lg:min-h-[480px] scroll-mt-24 overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="absolute inset-0 z-0">
        <img src={backgroundImage} alt="" className="w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
      </div>
      <div className="container-wide relative z-10 py-16 lg:py-20">
        <motion.div 
          initial={{ opacity: 0, x: isReversed ? 50 : -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className={`max-w-3xl ${isReversed ? 'ml-auto' : ''}`}
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-accent/20 backdrop-blur-sm flex items-center justify-center border border-accent/30 hover:scale-110 transition-transform duration-300">
              <Icon className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl text-primary-foreground">{title}</h2>
              <p className="text-primary-foreground/70">{subtitle}</p>
            </div>
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">{description}</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }} className="flex flex-wrap gap-3 mb-8">
            {partners.map((partner) => (
              <div key={partner} className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm border border-accent/30 text-primary-foreground px-4 py-2 rounded-full hover:bg-accent/30 transition-colors" itemProp="brand" itemScope itemType="https://schema.org/Brand">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium" itemProp="name">{partner}</span>
              </div>
            ))}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.5 }} className="flex flex-wrap gap-2 mb-8">
            {features.map((feature) => (
              <span key={feature} className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 text-primary-foreground/90 px-3 py-1.5 rounded-lg text-sm hover:bg-primary-foreground/20 transition-colors" itemProp="hasOfferCatalog">
                <CheckCircle className="h-3.5 w-3.5 text-accent" />{feature}
              </span>
            ))}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.6 }} className="inline-flex items-center gap-2 bg-card/90 backdrop-blur-sm text-foreground px-4 py-2.5 rounded-xl mb-8 shadow-lg" itemProp="audience" itemScope itemType="https://schema.org/Audience">
            <span className="text-xs text-muted-foreground">Geschikt voor:</span>
            <span className="text-sm font-medium" itemProp="audienceType">{forWho}</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.7 }} className="flex flex-wrap gap-4">
            <Button variant="accent" size="lg" asChild className="hover:scale-105 transition-transform duration-200">
              <LocalizedLink to={href}>{cta}<ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
            <Button variant="heroOutline" size="lg" asChild className="hover:scale-105 transition-transform duration-200">
              <LocalizedLink to="/contact">Vraag advies aan</LocalizedLink>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
