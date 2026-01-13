import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

const footerLinks = {
  diensten: [
    { href: "/verzekeringen", label: "Verzekeringen" },
    { href: "/verzekeringen#beroepsaansprakelijkheid", label: "Beroepsaansprakelijkheid" },
    { href: "/verzekeringen#arbeidsongeschiktheid", label: "Arbeidsongeschiktheid" },
    { href: "/verzekeringen#rechtsbijstand", label: "Rechtsbijstand" },
  ],
  informatie: [
    { href: "/voor-wie", label: "Voor wie" },
    { href: "/zo-werken-wij", label: "Zo werken wij" },
    { href: "/kennis", label: "Kennis & advies" },
    { href: "/over-ons", label: "Over ons" },
  ],
  juridisch: [
    { href: "/privacy", label: "Privacybeleid" },
    { href: "/voorwaarden", label: "Algemene voorwaarden" },
    { href: "/cookies", label: "Cookiebeleid" },
    { href: "/klachten", label: "Klachtenprocedure" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-wide section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground">
                <span className="text-lg font-bold text-primary">ZP</span>
              </div>
              <span className="text-2xl font-bold">zpzaken</span>
            </Link>
            <p className="text-primary-foreground/80 mb-6 max-w-sm">
              Onafhankelijk advies voor zzp'ers en ondernemers. Wij helpen je met verzekeringen en zakelijke zekerheid, zonder tussenpersonen.
            </p>
            <div className="space-y-3">
              <a href="tel:0201234567" className="flex items-center gap-3 text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <Phone className="h-5 w-5" />
                020 - 123 4567
              </a>
              <a href="mailto:info@zpzaken.nl" className="flex items-center gap-3 text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <Mail className="h-5 w-5" />
                info@zpzaken.nl
              </a>
              <div className="flex items-center gap-3 text-primary-foreground/80">
                <MapPin className="h-5 w-5" />
                Amsterdam, Nederland
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Diensten</h4>
            <ul className="space-y-3">
              {footerLinks.diensten.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Informatie</h4>
            <ul className="space-y-3">
              {footerLinks.informatie.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Juridisch</h4>
            <ul className="space-y-3">
              {footerLinks.juridisch.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-primary-foreground/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-primary-foreground/60 text-sm">
              © {new Date().getFullYear()} zpzaken.nl. Alle rechten voorbehouden.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-primary-foreground/60 text-sm">AFM geregistreerd</span>
              <span className="text-primary-foreground/60 text-sm">Kifid aangesloten</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
