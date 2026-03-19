import { ReactNode } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { ArrowRight, Sparkles, CheckCircle, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { MiniSocialProof } from "@/components/shared/MiniSocialProof";
import teamCheers from "@/assets/team-cheers.jpg";

interface Benefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface ExplainerBlock {
  image: string;
  title: string;
  text: string;
  bullets?: string[];
}

interface ServicePageTemplateProps {
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  heroImage: string;
  badge: string;
  title: ReactNode;
  subtitle: string;
  benefits: Benefit[];
  explainers: ExplainerBlock[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
  children?: ReactNode;
  schema?: Record<string, unknown>;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

export function ServicePageTemplate({
  seoTitle,
  seoDescription,
  canonicalPath,
  heroImage,
  badge,
  title,
  subtitle,
  benefits,
  explainers,
  ctaTitle,
  ctaSubtitle,
  ctaButton,
  children,
  schema,
}: ServicePageTemplateProps) {
  return (
    <Layout>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={`https://zpzaken.nl${canonicalPath}`}
      >
        {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
      </SEOHead>

      {/* Hero */}
      <PageHero
        title={title}
        subtitle={subtitle}
        badge={{ icon: <Sparkles className="h-4 w-4" />, text: badge }}
        backgroundImage={heroImage}
      >
        <Button variant="accent" size="lg" asChild>
          <LocalizedLink to="/contact">
            Advies aanvragen <ArrowRight className="h-5 w-5" />
          </LocalizedLink>
        </Button>
      </PageHero>

      {/* Benefits - 3 columns */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                  <b.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{b.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Optional children (e.g. wizard) */}
      {children}

      {/* Explainer blocks — alternating image/text */}
      {explainers.map((block, i) => {
        const imageLeft = i % 2 === 0;
        return (
          <section
            key={i}
            className={`section-padding ${i % 2 === 0 ? "bg-background" : "bg-secondary"}`}
          >
            <div className="container-wide">
              <div className={`grid lg:grid-cols-2 gap-12 items-center ${!imageLeft ? "lg:grid-flow-col-dense" : ""}`}>
                {/* Image */}
                <motion.div
                  initial={{ opacity: 0, x: imageLeft ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className={!imageLeft ? "lg:col-start-2" : ""}
                >
                  <div className="rounded-2xl overflow-hidden shadow-lg">
                    <img
                      src={block.image}
                      alt={block.title}
                      className="w-full h-72 lg:h-96 object-cover"
                      loading="lazy"
                    />
                  </div>
                </motion.div>

                {/* Text */}
                <motion.div
                  initial={{ opacity: 0, x: imageLeft ? 30 : -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  className={!imageLeft ? "lg:col-start-1 lg:row-start-1" : ""}
                >
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">{block.title}</h2>
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{block.text}</p>
                  {block.bullets && (
                    <ul className="space-y-3">
                      {block.bullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </div>
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={teamCheers} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent/95 via-accent/90 to-accent/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-4 text-white"
            >
              {ctaTitle}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/80 mb-8"
            >
              {ctaSubtitle}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button size="lg" asChild className="bg-white text-accent hover:bg-white/90 shadow-lg">
                <LocalizedLink to="/contact">
                  {ctaButton} <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <a
                href="tel:0232010502"
                className="inline-flex items-center gap-2 text-white border border-white/40 rounded-lg px-5 py-3 hover:bg-white/10 transition-all font-medium"
              >
                📞 023 - 201 0502
              </a>
            </motion.div>
            <div className="mt-6">
              <MiniSocialProof variant="dark" className="justify-center" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
