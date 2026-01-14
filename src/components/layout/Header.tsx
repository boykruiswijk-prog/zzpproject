import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";
import logoZp from "@/assets/logo-zp.png";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/verzekeringen", label: "Verzekeringen" },
  { href: "/voor-wie", label: "Voor wie" },
  { href: "/zo-werken-wij", label: "Zo werken wij" },
  { href: "/kennis", label: "Kennis & advies" },
  { href: "/over-ons", label: "Over ons" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-wide flex h-16 items-center justify-between lg:h-20">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoZp} alt="ZP Zaken logo" className="h-10 w-10 rounded-lg" />
          <span className="text-xl font-bold text-primary">zpzaken</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                location.pathname === item.href
                  ? "text-primary bg-secondary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <a href="tel:0201234567" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-4 w-4" />
            020 - 123 4567
          </a>
          <Button variant="accent" asChild>
            <Link to="/contact">Gratis adviesgesprek</Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2 text-foreground"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container-wide py-4 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  location.pathname === item.href
                    ? "text-primary bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border mt-2 flex flex-col gap-3">
              <a href="tel:0201234567" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
                <Phone className="h-4 w-4" />
                020 - 123 4567
              </a>
              <Button variant="accent" className="w-full" asChild>
                <Link to="/contact" onClick={() => setIsOpen(false)}>Gratis adviesgesprek</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
