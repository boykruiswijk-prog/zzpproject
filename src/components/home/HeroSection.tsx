import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Phone, Shield, Users } from "lucide-react";
import { motion } from "framer-motion";
import { LocalizedLink } from "@/components/LocalizedLink";
import teamWalking from "@/assets/team-walking.jpg";

export function HeroSection() {
  const { t } = useTranslation();

  const usps = [
    t("home.usp1"),
    t("home.usp2"),
    t("home.usp3"),
  ];

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={teamWalking} alt="ZP Zaken" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/85 to-foreground/70" />
      </div>

      <div className="container-wide relative z-10 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary-foreground px-4 py-2 rounded-full mb-6"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">{t("home.trustBadge")}</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-6 leading-tight text-primary-foreground"
            >
              {t("home.heroTitle")}{" "}
              <span className="text-primary">{t("home.heroTitleAccent")}</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg text-primary-foreground/80 mb-8 max-w-lg"
            >
              {t("home.heroSubtitle")}
            </motion.p>

            <motion.ul 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="space-y-3 mb-8"
            >
              {usps.map((usp, index) => (
                <motion.li 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-primary-foreground">{usp}</span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              <Button variant="accent" size="xl" asChild className="shadow-lg hover:scale-105 transition-transform duration-200">
                <LocalizedLink to="/diensten">
                  {t("home.ctaDiensten")}
                  <ArrowRight className="h-5 w-5" />
                </LocalizedLink>
              </Button>
              <Button 
                size="xl" 
                asChild
                className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 backdrop-blur-sm border border-primary-foreground/50 hover:scale-105 transition-transform duration-200"
              >
                <LocalizedLink to="/contact">{t("home.ctaAdvies")}</LocalizedLink>
              </Button>
            </motion.div>

            <motion.a 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
              href="tel:0232010502" 
              className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span>023 - 201 0502</span>
            </motion.a>
          </motion.div>

          <div className="hidden lg:flex justify-end">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative"
            >
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-border/50 max-w-sm hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-foreground">2.500+</h3>
                    <p className="text-muted-foreground">{t("home.satisfied")}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">{t("home.satisfaction")}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-foreground">4.9/5</span>
                      <span className="text-amber-500">⭐</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">{t("home.responseTime")}</span>
                    <span className="font-semibold text-foreground">&lt; 24 uur</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">{t("home.experience")}</span>
                    <span className="font-semibold text-foreground">10+ jaar</span>
                  </div>
                </div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -bottom-4 -left-4 bg-accent text-accent-foreground px-5 py-3 rounded-xl shadow-lg font-semibold flex items-center gap-2"
              >
                <CheckCircle className="h-5 w-5" />
                {t("home.directAdvice")}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
