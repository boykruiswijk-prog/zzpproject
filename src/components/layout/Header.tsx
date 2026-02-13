import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoZp from "@/assets/logo-zp.webp";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocalizedLink } from "@/components/LocalizedLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useNavItems() {
  const { t } = useTranslation();
  return [
    { 
      href: "/diensten", 
      label: t("nav.diensten"),
      children: [
        { href: "/diensten", label: t("nav.alleDiensten") },
        { href: "/verzekeringen", label: "Verzekeringen" },
        { href: "/diensten#administratie", label: "Administratie & Boekhouding" },
        { href: "/diensten#juridisch", label: "Juridisch Advies" },
        { href: "/diensten#screening", label: "Screening" },
        { href: "/diensten#financiering", label: "Factoring & Financiering" },
      ]
    },
    { 
      href: "/collectieve-inkoop", 
      label: t("nav.collectief"), 
      isNew: true,
      children: [
        { href: "/collectieve-inkoop", label: t("nav.collectieveInkoopOverzicht") },
        { href: "/collectief-ledenorganisaties", label: t("nav.collectiefLedenorganisaties") },
      ]
    },
    { 
      href: "/kennisbank", 
      label: t("nav.kennisbank"),
      children: [
        { href: "/kennisbank", label: t("nav.artikelen") },
        { href: "/faq", label: t("nav.faq") },
        { href: "/kennis", label: t("nav.kennisAdvies") },
      ]
    },
    { 
      href: "/over-ons", 
      label: t("nav.overOns"),
      children: [
        { href: "/over-ons", label: t("nav.hetTeam") },
        { href: "/voor-wie", label: t("nav.voorWie") },
        { href: "/zo-werken-wij", label: t("nav.zoWerkenWij") },
        { href: "/partners", label: t("nav.partners") },
        { href: "/historie", label: t("nav.onzeHistorie") },
        { href: "/social-media", label: t("nav.socialMedia") },
      ]
    },
    { href: "/contact", label: t("nav.contact") },
  ];
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();
  const navItems = useNavItems();

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
        <LocalizedLink to="/" className="flex items-center">
          <img src={logoZp} alt="ZP Zaken logo" className="h-10" />
        </LocalizedLink>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            item.children ? (
              <DropdownMenu key={item.href}>
              <DropdownMenuTrigger className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  (item.children || []).some(c => location.pathname === c.href) || location.pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                  {item.label}
                  {'isNew' in item && item.isNew && (
                    <span className="text-[10px] font-bold uppercase bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full leading-none">Nieuw</span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {item.children.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <LocalizedLink to={child.href}>{child.label}</LocalizedLink>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LocalizedLink
                key={item.href}
                to={item.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  location.pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                {'isNew' in item && item.isNew && (
                  <span className="text-[10px] font-bold uppercase bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full leading-none">Nieuw</span>
                )}
              </LocalizedLink>
            )
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <LanguageSwitcher />
          <a href="tel:0232010502" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-4 w-4" />
            {t("nav.phone")}
          </a>
          <Button
            variant="outline"
            className="bg-foreground/70 text-background border-background/20 hover:bg-foreground/80 hover:text-background backdrop-blur-sm shadow-sm"
            asChild
          >
            <LocalizedLink to="/contact">{t("nav.gratisAdvies")}</LocalizedLink>
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
                    <LocalizedLink
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
                    </LocalizedLink>
                  ))}
                </div>
              ) : (
                <LocalizedLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                    location.pathname === item.href
                      ? "text-primary bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {item.label}
                  {'isNew' in item && item.isNew && (
                    <span className="text-[10px] font-bold uppercase bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full leading-none">Nieuw</span>
                  )}
                </LocalizedLink>
              )
            ))}
            <div className="pt-4 border-t border-border mt-2 flex flex-col gap-3">
              <LanguageSwitcher />
              <a href="tel:0232010502" className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {t("nav.phone")}
              </a>
              <Button variant="accent" className="mx-4" asChild>
                <LocalizedLink to="/contact" onClick={() => setIsOpen(false)}>{t("nav.gratisAdviesgesprek")}</LocalizedLink>
              </Button>
            </div>
          </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
