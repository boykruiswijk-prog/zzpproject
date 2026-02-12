import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import logoZp from "@/assets/logo-zp.webp";

export function Footer() {
  const { t } = useTranslation();

  const footerLinks = {
    diensten: [
      { href: "/diensten", label: t("footer.alleDiensten") },
      { href: "/verzekeringen", label: t("footer.verzekeringen") },
      { href: "/diensten#screening", label: t("footer.screening") },
    ],
    informatie: [
      { href: "/voor-wie", label: t("footer.voorWie") },
      { href: "/zo-werken-wij", label: t("footer.zoWerkenWij") },
      { href: "/partners", label: t("footer.partners") },
      { href: "/kennisbank", label: t("footer.kennisbank") },
      { href: "/faq", label: t("footer.veelgesteldeVragen") },
      { href: "/over-ons", label: t("footer.overOns") },
    ],
    juridisch: [
      { href: "/privacy", label: t("footer.privacybeleid") },
      { href: "/voorwaarden", label: t("footer.algemeneVoorwaarden") },
      { href: "/klachten", label: t("footer.klachtenprocedure") },
    ],
  };

  return (
    <footer className="bg-foreground text-background">
      <div className="container-wide section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              to="/"
              className="inline-flex items-center mb-5 rounded-lg bg-background p-2"
              aria-label="Ga naar de homepage"
            >
              <img src={logoZp} alt="ZP Zaken logo" className="h-8 w-auto object-contain" />
            </Link>
            <p className="text-background/70 mb-5 max-w-sm text-sm">
              {t("footer.description")}
            </p>
            <div className="space-y-2">
              <a href="tel:0232010502" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Phone className="h-4 w-4" />
                023 - 201 0502
              </a>
              <a href="mailto:info@zpzaken.nl" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Mail className="h-4 w-4" />
                info@zpzaken.nl
              </a>
              <div className="flex items-start gap-2 text-sm text-background/70">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Tupolevlaan 41, 1119 NW Schiphol-Rijk</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">{t("footer.diensten")}</h4>
            <ul className="space-y-2">
              {footerLinks.diensten.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">{t("footer.informatie")}</h4>
            <ul className="space-y-2">
              {footerLinks.informatie.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">{t("footer.juridisch")}</h4>
            <ul className="space-y-2">
              {footerLinks.juridisch.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-background/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-background/50 text-xs">
              {t("footer.copyright")}
            </p>
            <div className="flex items-center gap-6">
              <span className="text-background/50 text-xs">{t("footer.afm")}</span>
              <span className="text-background/50 text-xs">{t("footer.kifid")}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
