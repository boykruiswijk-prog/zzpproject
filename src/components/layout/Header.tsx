import { openTerugbelKlik } from "@/components/shared/TerugbelDialog";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, ChevronDown, FileText, Pause, FolderDown, Shield, XCircle, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoZp from "@/assets/logo-zp.webp";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocalizedLink } from "@/components/LocalizedLink";
import { SiteSearch } from "@/components/search/SiteSearch";

function useNavItems() {
  const { t } = useTranslation();
  return [
    { 
      href: "/diensten", 
      label: t("nav.diensten"),
      children: [
        { href: "/diensten", label: t("nav.alleDiensten") },
        { href: "/verzekeringen", label: "Verzekeringen" },
        { href: "/starters", label: "Starterspakket" },
        { href: "/diensten#administratie", label: "Administratie & Boekhouding" },
        { href: "/diensten#juridisch", label: "Juridische Hulp" },
        { href: "/screening", label: "Screening" },
        { href: "/diensten#financiering", label: "Factoring & Financiering" },
      ]
    },
    { 
      href: "/collectieve-inkoop", 
      label: t("nav.collectief"), 
      isNew: true,
      children: [
        /* TODO: Re-enable ledenorganisaties link when ready to go live */
        // { href: "/collectief-ledenorganisaties", label: t("nav.collectiefLedenorganisaties") },
        { href: "/collectieve-inkoop", label: t("nav.collectieveInkoopOverzicht") },
      ]
    },
    { 
      href: "/kennisbank", 
      label: t("nav.kennisbank"),
      children: [
        { href: "/kennisbank", label: t("nav.artikelen") },
        { href: "/kennisbank/wet-en-regelgeving", label: "Wet en regelgeving" },
        { href: "/kennisbank/ondernemen", label: "Ondernemen" },
        { href: "/kennisbank/belastingen", label: "Belastingen" },
        { href: "/kennisbank/financien", label: "Financiën" },
        { href: "/kennisbank/verzekeringen", label: "Verzekeringen" },
        { href: "/faq", label: t("nav.faq") },
      ]
    },
    { 
      href: "/over-ons", 
      label: t("nav.overOns"),
      children: [
        { href: "/over-ons", label: t("nav.hetTeam") },
        { href: "/waarom-zp-zaken", label: "Waarom ZP Zaken" },
        { href: "/voor-wie", label: t("nav.voorWie") },
        { href: "/zo-werken-wij", label: t("nav.zoWerkenWij") },
        { href: "/partners", label: t("nav.partners") },
        { href: "/historie", label: t("nav.onzeHistorie") },
        { href: "/social-media", label: t("nav.socialMedia") },
      ]
    },
    {
      href: "/portal/login",
      label: "Mijn ZP",
      isService: true,
      children: [
        { href: "/portal/login", label: "Inloggen klantportaal", icon: LogIn },
        { href: "/mijn-zp/polis", label: "Verzekeringscertificaat opvragen", icon: FileText },
        { href: "/mijn-zp/pauzeren", label: "Verzekering pauzeren", icon: Pause },
        { href: "/mijn-zp/documenten", label: "Documenten opvragen", icon: FolderDown },
        { href: "/documenten", label: "Polisvoorwaarden", icon: FileText },
        { href: "/mijn-zp/opzeggen", label: "Verzekering opzeggen", icon: XCircle },
      ],
    },
    { href: "/contact", label: t("nav.contact") },
  ];
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useTranslation();
  const navItems = useNavItems();

  useEffect(() => setOpenMenu(null), [location.pathname]);

  // Sluit het mobiele menu bij een routewissel.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  // Zet scrollen van de body uit zolang het mobiele menu open staat.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

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
          <img decoding="async" fetchpriority="high" src={logoZp} alt="ZP Zaken logo" width={161} height={90} className="h-10 w-auto" />
        </LocalizedLink>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => (
            item.children ? (
              <div
                key={item.href}
                className="relative group"
                onMouseLeave={() => setOpenMenu(null)}
              >
                <div className={`flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                  'isService' in item && item.isService
                    ? "text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20"
                    : (item.children || []).some(c => location.pathname === c.href) || location.pathname === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                }`}>
                  <LocalizedLink to={item.href} className="flex items-center gap-1 py-2 pl-3">
                    {'isService' in item && item.isService && <Shield className="h-3.5 w-3.5" />}
                    {item.label}
                    {'isNew' in item && item.isNew && (
                      <span className="whitespace-nowrap rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-accent-foreground">Nieuw</span>
                    )}
                  </LocalizedLink>
                  <button
                    type="button"
                    className="py-2 pl-1 pr-3"
                    aria-expanded={openMenu === item.href}
                    aria-label={`Submenu ${item.label}`}
                    onClick={() => setOpenMenu(openMenu === item.href ? null : item.href)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className={`absolute left-0 top-full z-50 pt-1 group-hover:block group-focus-within:block ${openMenu === item.href ? "block" : "hidden"}`}>
                  <div className={`rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ${'isService' in item && item.isService ? "min-w-[260px]" : "min-w-[220px]"}`}>
                    {item.children.map((child) => {
                      const Icon = 'icon' in child ? (child as any).icon : null;
                      return (
                        <LocalizedLink
                          key={child.href}
                          to={child.href}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                          {Icon && <Icon className="h-4 w-4 text-primary" />}
                          {child.label}
                        </LocalizedLink>
                      );
                    })}
                    {'isService' in item && item.isService && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border mt-1">
                        Service-aanvragen voor bestaande klanten
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <LocalizedLink
                key={item.href}
                to={item.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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

        <div className="hidden xl:flex items-center gap-3">
          <SiteSearch />
          <LanguageSwitcher />
          <a href="tel:+31204573077" className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-4 w-4" />
            020 - 457 3077
          </a>
          <Button
            variant="outline"
            className="bg-foreground/70 text-background border-background/20 hover:bg-foreground/80 hover:text-background backdrop-blur-sm shadow-sm"
            asChild
          >
            <LocalizedLink to="/contact" onClick={openTerugbelKlik}>{t("nav.gratisAdvies")}</LocalizedLink>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
            className="p-2 text-foreground xl:hidden"
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
            className="overflow-hidden border-t border-border bg-background xl:hidden"
          >
            <nav
              className="container-wide py-4 flex flex-col gap-1 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
              style={{
                paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
              }}
            >
            {navItems.map((item) => (
              item.children ? (
                <div key={item.href}>
                  <span className="px-4 py-2 text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {item.label}
                    {'isNew' in item && item.isNew && (
                       <span className="whitespace-nowrap rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-accent-foreground">Nieuw</span>
                    )}
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
              <a href="tel:0204573077" className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {t("nav.phone")}
              </a>
              <Button variant="accent" className="mx-4" asChild>
                <LocalizedLink to="/contact" onClick={(e) => { setIsOpen(false); openTerugbelKlik(e); }}>{t("nav.gratisPersoonlijk gesprek")}</LocalizedLink>
              </Button>
            </div>
          </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
