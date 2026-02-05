import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoZp from "@/assets/logo-zp.webp";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/diensten", label: "Diensten" },
  { href: "/voor-wie", label: "Voor wie" },
  { href: "/zo-werken-wij", label: "Zo werken wij" },
  { href: "/partners", label: "Partners" },
  { 
    href: "/kennisbank", 
    label: "Kennisbank",
    children: [
      { href: "/kennisbank", label: "Alle artikelen" },
      { href: "/kennis", label: "Kennis & advies" },
    ]
  },
  { href: "/faq", label: "FAQ" },
  { 
    href: "/over-ons", 
    label: "Over ons",
    children: [
      { href: "/over-ons", label: "Het team" },
      { href: "/historie", label: "Onze historie" },
    ]
  },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border" 
          : "bg-background border-b border-border"
      }`}
    >
      <div className="container-wide flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logoZp} alt="ZP Zaken logo" className="h-10" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            item.children ? (
              <DropdownMenu key={item.href}>
                <DropdownMenuTrigger className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  location.pathname.startsWith('/kennis')
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                  {item.label}
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {item.children.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link to={child.href}>{child.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.href}
                to={item.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  location.pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <a href="tel:0232010502" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-4 w-4" />
            023 - 201 0502
          </a>
          <Button
            variant="outline"
            className="bg-foreground/70 text-background border-background/20 hover:bg-foreground/80 hover:text-background backdrop-blur-sm shadow-sm"
            asChild
          >
            <Link to="/contact">Gratis advies</Link>
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
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden border-t border-border bg-background overflow-hidden"
          >
            <nav className="container-wide py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              item.children ? (
                <div key={item.href}>
                  <span className="px-4 py-2 text-sm font-medium text-muted-foreground block">
                    {item.label}
                  </span>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      to={child.href}
                      onClick={() => setIsOpen(false)}
                      className={`pl-8 pr-4 py-2 text-sm rounded-md block transition-colors ${
                        location.pathname === child.href
                          ? "text-primary bg-secondary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === item.href
                      ? "text-primary bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {item.label}
                </Link>
              )
            ))}
            <div className="pt-4 border-t border-border mt-2 flex flex-col gap-3">
              <a href="tel:0232010502" className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                023 - 201 0502
              </a>
              <Button variant="accent" className="mx-4" asChild>
                <Link to="/contact" onClick={() => setIsOpen(false)}>Gratis adviesgesprek</Link>
              </Button>
            </div>
          </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
