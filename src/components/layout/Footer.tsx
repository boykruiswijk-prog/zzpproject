import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import logoZp from "@/assets/logo-zp.webp";

const footerLinks = {
  diensten: [
    { href: "/diensten", label: "Alle diensten" },
    { href: "/verzekeringen", label: "Verzekeringen" },
    { href: "/diensten#screening", label: "Screening" },
  ],
  informatie: [
    { href: "/voor-wie", label: "Voor wie" },
    { href: "/zo-werken-wij", label: "Zo werken wij" },
    { href: "/partners", label: "Partners" },
    { href: "/kennisbank", label: "Kennisbank" },
    { href: "/over-ons", label: "Over ons" },
  ],
  juridisch: [
    { href: "/privacy", label: "Privacybeleid" },
    { href: "/voorwaarden", label: "Algemene voorwaarden" },
    { href: "/klachten", label: "Klachtenprocedure" },
  ],
};

export function Footer() {
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
              Onafhankelijk advies voor zzp'ers en ondernemers. Wij helpen je met verzekeringen en zakelijke zekerheid, zonder tussenpersonen.
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
            <h4 className="font-semibold mb-4 text-sm">Diensten</h4>
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
            <h4 className="font-semibold mb-4 text-sm">Informatie</h4>
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
            <h4 className="font-semibold mb-4 text-sm">Juridisch</h4>
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
              © 2026 | ZP Zaken B.V. | Zorgeloos ZZP'en
            </p>
            <div className="flex items-center gap-6">
              <span className="text-background/50 text-xs">AFM vergunningsnummer 12050636</span>
              <span className="text-background/50 text-xs">Kifid aangesloten</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
