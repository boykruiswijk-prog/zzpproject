import { useLocation, Navigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { legacyRedirects } from "@/config/legacyRedirects";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Phone, HelpCircle, ArrowRight } from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Client-side vangnet voor oude WordPress-URL's. De serverside 301's staan in
 * public/_redirects (gegenereerd uit src/config/legacyRedirects.ts).
 */
const REDIRECT_MAP: Record<string, string> = Object.fromEntries(
  legacyRedirects.map(({ from, to }) => [`/${from}`.toLowerCase(), to]),
);

const popularPages = [
  {
    icon: Shield,
    title: "BAV + AVB Verzekering",
    text: "Direct online afsluiten vanaf €55/maand",
    link: "/verzekeringen",
  },
  {
    icon: FileText,
    title: "Kennisbank",
    text: "Artikelen over verzekeringen en wet DBA",
    link: "/kennisbank",
  },
  {
    icon: Phone,
    title: "Vrijblijvend gesprek",
    text: "Binnen 24 uur persoonlijk antwoord",
    link: "/contact",
  },
  {
    icon: HelpCircle,
    title: "Veelgestelde vragen",
    text: "Antwoorden op de meest gestelde vragen",
    link: "/faq",
  },
];

const NotFound = () => {
  const location = useLocation();
  const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, "") || "/";
  const redirect = REDIRECT_MAP[normalizedPath];

  useEffect(() => {
    if (!redirect) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "page_not_found", {
          event_category: "error",
          event_label: window.location.pathname,
        });
      }
    }
  }, [location.pathname, redirect]);

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <Layout>
      <SEOHead
        title="Pagina niet gevonden | ZP Zaken"
        description="Deze pagina bestaat niet meer. Bekijk de populaire pagina's van ZP Zaken of neem contact op."
        noindex
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-background py-20 md:py-28">
        <div className="container-wide relative">
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
          >
            <span className="font-bold text-muted/40 leading-none text-[180px] sm:text-[260px] md:text-[360px]">
              404
            </span>
          </div>
          <div className="relative text-center max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Deze pagina bestaat niet meer
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Geen zorgen, je bent wel op de juiste plek voor zorgeloos ondernemen.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="accent" size="lg" asChild>
                <Link to="/">
                  Naar de homepage <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Link to="/contact">
                  Vrijblijvend gesprek <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Populaire pagina's */}
      <section className="section-padding bg-secondary/30">
        <div className="container-wide">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            Misschien zoek je dit?
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {popularPages.map(({ icon: Icon, title, text, link }) => (
              <Link
                key={title}
                to={link}
                className="group bg-card border border-border/50 rounded-2xl p-5 md:p-6 hover:border-accent/40 hover:shadow-md transition-all"
              >
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-accent/10 text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-accent transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats balk */}
      <section className="py-12 bg-background border-t border-border/50">
        <div className="container-wide">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-accent mb-1">5.000+</div>
              <div className="text-sm text-muted-foreground">tevreden zzp'ers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-1">5,0/5</div>
              <div className="text-sm text-muted-foreground">Google Reviews</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent mb-1">13+</div>
              <div className="text-sm text-muted-foreground">jaar ervaring</div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
