import { Phone, Mail, MapPin, MessageCircle, Linkedin, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";
import logoZp from "@/assets/logo-zp.webp";
import { LocalizedLink } from "@/components/LocalizedLink";

export function Footer() {
  const { t } = useTranslation();

  const footerLinks = {
    diensten: [
      { href: "/diensten", label: t("footer.alleDiensten") },
      { href: "/verzekeringen", label: t("footer.verzekeringen") },
      { href: "/screening", label: "Screening" },
    ],
    overOns: [
      { href: "/voor-wie", label: t("footer.voorWie") },
      { href: "/zo-werken-wij", label: t("footer.zoWerkenWij") },
      { href: "/partners", label: t("footer.partners") },
      { href: "/kennisbank", label: t("footer.kennisbank") },
      { href: "/faq", label: t("footer.veelgesteldeVragen") },
      { href: "/over-ons", label: t("footer.overOns") },
    ],
    informatie: [
      { href: "/documenten", label: "Documenten" },
      { href: "/algemene-voorwaarden", label: t("footer.algemeneVoorwaarden") },
      { href: "/cookies", label: t("footer.privacybeleid") },
      { href: "/cookies", label: "Cookies" },
      { href: "/klachten", label: t("footer.klachtenprocedure") },
    ],
  };

  return (
    <footer className="bg-foreground text-background">
      <div className="container-wide section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <LocalizedLink
              to="/"
              className="inline-flex items-center mb-5 rounded-lg bg-background p-2"
              aria-label="Ga naar de homepage"
            >
              <img src={logoZp} alt="ZP Zaken logo" className="h-8 w-auto object-contain" />
            </LocalizedLink>
            <p className="text-background/70 mb-5 max-w-sm text-sm">
              <span className="font-semibold text-background">ZP Zaken B.V.</span>, {t("footer.description")}
            </p>
            <div className="space-y-2">
              <a href="tel:+31204573077" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Phone className="h-4 w-4" />
                020 - 457 3077
              </a>
              <a href="mailto:info@zpzaken.nl" className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors">
                <Mail className="h-4 w-4" />
                info@zpzaken.nl
              </a>
              <a
                href="https://wa.me/31652064589"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <div className="flex items-start gap-2 text-sm text-background/70">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Tupolevlaan 41, 1119 NW Schiphol-Rijk</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://www.linkedin.com/company/zp-zaken"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="h-9 w-9 rounded-lg bg-background/10 hover:bg-background/20 flex items-center justify-center text-background/80 hover:text-background transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/zpzaken/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="h-9 w-9 rounded-lg bg-background/10 hover:bg-background/20 flex items-center justify-center text-background/80 hover:text-background transition-colors"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm">{t("footer.diensten")}</h4>
            <ul className="space-y-2">
              {footerLinks.diensten.map((link) => (
                <li key={link.href}>
                  <LocalizedLink to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </LocalizedLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">{t("footer.informatie")}</h4>
            <ul className="space-y-2">
              {footerLinks.overOns.map((link) => (
                <li key={link.href}>
                  <LocalizedLink to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </LocalizedLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Documenten & juridisch</h4>
            <ul className="space-y-2">
              {footerLinks.informatie.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <LocalizedLink to={link.href} className="text-background/60 hover:text-background transition-colors text-sm">
                    {link.label}
                  </LocalizedLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-background/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <p className="text-background/50 text-xs">
              {t("footer.copyright")}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-background/50">
              <span>AFM nr. 12050636</span>
              <span>KvK 62117092</span>
              <span>Kifid nr. 300.019283</span>
              <a
                href="/documenten/gedragscode.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-background transition-colors underline-offset-2 hover:underline"
              >
                Gedragscode
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
